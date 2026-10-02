// 전체 평가 계산: 순자산가액 → 순손익가치 → 영업권 → 1주당 평가액
// (상증세법 시행령 제54조, 제55조, 제56조, 제59조)
import { accountValue, type AccountValue } from "./accounts.ts";
import { netIncomeYear, type NetIncomeYearResult } from "./netIncome.ts";
import { isWithinYears, num, parseYmd } from "./num.ts";
import type { ValuationState } from "./types.ts";

export interface ValuationResult {
  ready: boolean; // 발행주식총수가 입력되어 1주당 금액을 계산할 수 있는지
  accounts: { id: string; value: AccountValue }[];
  netAsset: {
    assetBook: number;
    assetDiff: number;
    reserveInclude: number; // 법인세법상 유보금액 중 순자산에 가감하는 금액
    assetTotal: number;
    liabilityBook: number;
    liabilityDiff: number;
    liabilityTaxEtc: number;
    liabilityTotal: number;
    beforeGoodwill: number; // 영업권 포함 전 순자산가액
    goodwillApplied: number;
    netAssetValue: number;
  };
  netIncome: {
    years: NetIncomeYearResult[];
    weightedPerShare: number; // 최근 3년 가중평균액 (0 미만이면 0)
    rate: number;
    valuePerShare: number;
  };
  goodwill: {
    weightedNetIncome: number;
    half: number;
    equity: number;
    equityReturn: number;
    excess: number;
    presentValue: number;
    purchased: number;
    value: number;
    excluded: boolean; // 순자산가액에 합산하지 않는 경우
  };
  realEstate: {
    bookAssets: number;
    taxAssets: number;
    deductTotal: number;
    realEstateTotal: number;
    adjustedAssets: number;
    ratio: number;
    isHeavy: boolean; // 50% 초과
    isOver80: boolean; // 80% 이상
  };
  method: {
    isUnder3Years: boolean;
    deficit3y: boolean;
    netAssetOnlyReasons: string[];
    weights: "3:2" | "2:3" | "netAssetOnly";
  };
  perShare: {
    byNetIncome: number;
    byNetAsset: number;
    weighted: number;
    floor: number; // 순자산가치의 80%
    base: number; // 할증 전 평가액
    premiumRate: number;
    premiumExemptReasons: string[];
    final: number;
  };
  totalValue: number;
}

export function calculateValuation(state: ValuationState): ValuationResult {
  const { basic, adjustments, judgment } = state;
  const totalShares = num(basic.totalShares);
  const context = {
    valuationDate: basic.valuationDate,
    fiscalYearEndMonth: num(basic.fiscalYearEndMonth) || 12,
  };

  // 1) 계정과목별 평가
  const accounts = state.accounts.map((account) => ({ id: account.id, value: accountValue(account, context) }));
  const sumSide = (side: "asset" | "liability", pick: (value: AccountValue) => number) =>
    state.accounts.reduce((total, account, i) => (account.side === side ? total + pick(accounts[i].value) : total), 0);

  const assetBook = sumSide("asset", (v) => v.book);
  const assetDiff = sumSide("asset", (v) => v.diff);
  const liabilityBook = sumSide("liability", (v) => v.book);
  const liabilityDiff = sumSide("liability", (v) => v.diff);
  const reserveInclude = adjustments.reserves.reduce((total, row) => total + num(row.includeAmount), 0);
  const liabilityTaxEtc = num(adjustments.liabilityTaxEtc);

  const assetTotal = assetBook + assetDiff + reserveInclude;
  const liabilityTotal = liabilityBook + liabilityDiff + liabilityTaxEtc;
  const beforeGoodwill = assetTotal - liabilityTotal;

  // 2) 순손익가치
  const years = state.netIncome.map((year) => netIncomeYear(year, totalShares));
  const weightedPerShare = Math.max((years[0].perShare * 3 + years[1].perShare * 2 + years[2].perShare) / 6, 0);
  const rate = num(adjustments.capitalizationRatePercent) / 100;
  const byNetIncome = rate > 0 ? Math.trunc(weightedPerShare / rate) : 0;

  // 3) 부동산과다보유법인 판정
  const taxAssets = assetBook + num(judgment.reserveAdjust);
  const deductTotal =
    num(judgment.deductLand) +
    num(judgment.deductBuilding) +
    num(judgment.deductIntangible) +
    num(judgment.deductFinancial);
  const realEstateStock = num(judgment.realEstateStock);
  const realEstateTotal = num(judgment.realEstateLand) + num(judgment.realEstateBuilding) + realEstateStock;
  const adjustedAssets = taxAssets - deductTotal + realEstateTotal - realEstateStock;
  const realEstateRatio = adjustedAssets !== 0 ? realEstateTotal / adjustedAssets : 0;
  const isOver80 = realEstateRatio >= 0.8;
  const isHeavy = realEstateRatio > 0.5;

  // 4) 순자산가치만으로 평가하는 사유
  const start = parseYmd(basic.businessStartDate);
  const valuation = parseYmd(basic.valuationDate);
  const isUnder3Years = !!start && !!valuation && isWithinYears(start, valuation, 3);
  const allYearsEntered = state.netIncome.every((year) => year.taxableIncome.trim() !== "");
  const autoDeficit = allYearsEntered && state.netIncome.every((year) => num(year.taxableIncome) < 0);
  const deficit3y = judgment.deficit3y || autoDeficit;

  const netAssetOnlyReasons: string[] = [];
  if (isOver80) netAssetOnlyReasons.push("부동산 등 비율 80% 이상");
  if (num(judgment.stockRatioPercent) >= 80) netAssetOnlyReasons.push("주식 등 비율 80% 이상");
  if (judgment.liquidation) netAssetOnlyReasons.push("청산절차 진행 등 사업 계속 곤란");
  if (isUnder3Years) netAssetOnlyReasons.push("사업개시 후 3년 미만");
  if (judgment.dormant) netAssetOnlyReasons.push("사업개시 전 또는 휴업·폐업 중");
  if (deficit3y) netAssetOnlyReasons.push("3년 내 사업연도부터 계속 결손");
  if (judgment.limitedLife) netAssetOnlyReasons.push("잔여 존속기한 3년 이내");
  const netAssetOnly = netAssetOnlyReasons.length > 0;

  // 5) 영업권 (시행령 제59조 제2항). 제55조 제3항에 해당하면 순자산가액에 합산하지 않음.
  const weightedNetIncome = (years[0].annualized * 3 + years[1].annualized * 2 + years[2].annualized) / 6;
  const half = weightedNetIncome * 0.5;
  const equityReturn = beforeGoodwill < 0 ? 0 : beforeGoodwill * 0.1;
  const excess = half - equityReturn;
  let presentValue = 0;
  for (let n = 1; n <= 5; n++) presentValue += excess / 1.1 ** n;
  presentValue = Math.floor(presentValue);
  const purchased = num(adjustments.purchasedGoodwill);
  const goodwillValue = presentValue - purchased;
  const goodwillExcluded = judgment.liquidation || isOver80 || isUnder3Years || judgment.dormant || deficit3y;
  const goodwillApplied = goodwillExcluded ? 0 : Math.max(goodwillValue, 0);

  // 순자산가액이 0원 이하이면 0원으로 함 (시행령 제55조 제1항)
  const netAssetValue = Math.max(beforeGoodwill + goodwillApplied, 0);
  const byNetAsset = totalShares > 0 ? Math.trunc(netAssetValue / totalShares) : 0;

  // 6) 1주당 평가액
  let weights: "3:2" | "2:3" | "netAssetOnly";
  let weighted: number;
  if (netAssetOnly) {
    weights = "netAssetOnly";
    weighted = byNetAsset;
  } else if (isHeavy) {
    weights = "2:3";
    weighted = Math.trunc(byNetIncome * 0.4 + byNetAsset * 0.6);
  } else {
    weights = "3:2";
    weighted = Math.trunc(byNetIncome * 0.6 + byNetAsset * 0.4);
  }
  const floor = Math.trunc(byNetAsset * 0.8);
  const base = Math.max(weighted, floor);

  const premiumExemptReasons: string[] = [];
  if (!judgment.isMajorShareholder) premiumExemptReasons.push("최대주주 등에 해당하지 않음");
  if (judgment.isSmallBusiness) premiumExemptReasons.push("중소기업");
  if (deficit3y) premiumExemptReasons.push("3년 내 사업연도부터 계속 결손");
  if (judgment.mergerCase) premiumExemptReasons.push("합병·증자·감자 등에 따른 증여이익 계산 대상");
  if (judgment.earlyNoProfit) premiumExemptReasons.push("사업개시 3년 내 영업이익 0 이하");
  if (judgment.liquidationConfirmed) premiumExemptReasons.push("청산 확정");
  if (judgment.otherExempt) premiumExemptReasons.push("그 밖의 할증 제외 사유");
  const premiumRate = premiumExemptReasons.length === 0 ? 0.2 : 0;
  const final = Math.trunc(base * (1 + premiumRate));

  return {
    ready: totalShares > 0,
    accounts,
    netAsset: {
      assetBook,
      assetDiff,
      reserveInclude,
      assetTotal,
      liabilityBook,
      liabilityDiff,
      liabilityTaxEtc,
      liabilityTotal,
      beforeGoodwill,
      goodwillApplied,
      netAssetValue,
    },
    netIncome: { years, weightedPerShare, rate, valuePerShare: byNetIncome },
    goodwill: {
      weightedNetIncome,
      half,
      equity: beforeGoodwill,
      equityReturn,
      excess,
      presentValue,
      purchased,
      value: goodwillValue,
      excluded: goodwillExcluded,
    },
    realEstate: {
      bookAssets: assetBook,
      taxAssets,
      deductTotal,
      realEstateTotal,
      adjustedAssets,
      ratio: realEstateRatio,
      isHeavy,
      isOver80,
    },
    method: { isUnder3Years, deficit3y, netAssetOnlyReasons, weights },
    perShare: { byNetIncome, byNetAsset, weighted, floor, base, premiumRate, premiumExemptReasons, final },
    totalValue: final * totalShares,
  };
}
