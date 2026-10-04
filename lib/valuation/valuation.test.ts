// 실행: node --test lib/valuation/valuation.test.ts
// 모든 숫자는 검증용으로 만든 가상의 값이며, 기대값은 손으로 계산했습니다.
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  accountValue,
  calculateValuation,
  corporateTaxPayable,
  createAccount,
  createInitialState,
  emptyCorporateTax,
  emptyNetIncomeYear,
  interestWithholding,
  fixedAssetTaxValue,
  netIncomeYear,
  newId,
  type Account,
  type CorporateTaxInput,
  type FixedAssetRow,
  type Side,
  type ValuationMethod,
  type ValuationState,
} from "./index.ts";

function asset(partial: Partial<FixedAssetRow>): FixedAssetRow {
  return { id: newId(), name: "", acquisitionDate: "", cost: "", usefulLifeYears: "5", method: "declining", rate: "", ...partial };
}

test("정률법: 2개 사업연도 월할 상각", () => {
  // 2023년 12개월: 1,000,000 × 0.451 = 451,000 → 549,000
  // 2024년 9개월: 549,000 × 0.451 × 9/12 = 185,699.25 → 185,699 → 363,301
  const result = fixedAssetTaxValue(asset({ acquisitionDate: "2023-01-15", cost: "1000000" }), "2024-09-30", 12);
  assert.equal(result.taxBookValue, 363301);
  assert.deepEqual(result.periods.map((p) => p.months), [12, 9]);
});

test("정률법: 내용연수가 끝나면 비망가액 1,000원만 남김", () => {
  // 2022년: 1,000,000 × 0.777 = 777,000 → 223,000 / 2023년(상각 완료): 222,000 → 1,000
  const result = fixedAssetTaxValue(
    asset({ acquisitionDate: "2022-01-01", cost: "1000000", usefulLifeYears: "2" }),
    "2024-09-30",
    12,
  );
  assert.equal(result.taxBookValue, 1000);
});

test("정률법: 취득 첫해는 취득월부터 월할 상각", () => {
  // 7~9월 3개월: 1,200,000 × 0.528 × 3/12 = 158,400 → 1,041,600
  const result = fixedAssetTaxValue(
    asset({ acquisitionDate: "2024-07-10", cost: "1200000", usefulLifeYears: "4" }),
    "2024-09-30",
    12,
  );
  assert.equal(result.taxBookValue, 1041600);
});

test("정액법: 취득가액 기준 월할 상각", () => {
  // 2023년 6개월 120,000 + 2024년 9개월 180,000 → 900,000
  const result = fixedAssetTaxValue(
    asset({ acquisitionDate: "2023-07-01", cost: "1200000", method: "straight" }),
    "2024-09-30",
    12,
  );
  assert.equal(result.taxBookValue, 900000);
});

test("3월 결산 법인의 사업연도 구분", () => {
  // 2~3월 2개월: 75,167 → 924,833 / 4월~3월 12개월: 417,100 → 507,733 / 4~9월 6개월: 114,494 → 393,239
  const result = fixedAssetTaxValue(asset({ acquisitionDate: "2023-02-10", cost: "1000000" }), "2024-09-30", 3);
  assert.deepEqual(result.periods.map((p) => p.months), [2, 12, 6]);
  assert.equal(result.taxBookValue, 393239);
});

test("평가기준일 이후 취득 자산은 상각하지 않음", () => {
  const result = fixedAssetTaxValue(asset({ acquisitionDate: "2024-10-05", cost: "500000" }), "2024-09-30", 12);
  assert.equal(result.taxBookValue, 500000);
});

const TAX_INPUT: CorporateTaxInput = {
  ...emptyCorporateTax(),
  computedTax: "100000000",
  localComputedTax: "10000000",
  credits: [
    { id: "a", name: "공제 A", amount: "30000000", minimumTaxApplies: true, ruralTaxApplies: true, excluded: "10000000" },
    { id: "b", name: "공제 B", amount: "5000000", minimumTaxApplies: false, ruralTaxApplies: false, excluded: "" },
  ],
  minimumTax: "80000000",
  penaltyTax: "1000000",
  interimPrepaid: "20000000",
  withheld: "2000000",
  localPenaltyTax: "100000",
  localWithheld: "200000",
  unappropriatedIncomeTax: "3000000",
};

test("법인세 등 납부할 세액", () => {
  const result = corporateTaxPayable(TAX_INPUT);
  assert.equal(result.creditLimit, 20_000_000); // 산출세액 1억 − 최저한세 8천만
  assert.equal(result.creditsExcluded, 10_000_000); // 3천만 중 한도 2천만 초과분
  assert.equal(result.nationalTax, 76_000_000); // 1억 − 2천만 − 5백만 + 가산세 1백만
  assert.equal(result.nationalPayable, 54_000_000); // − 기납부 2천2백만
  assert.equal(result.ruralTax, 4_000_000); // (3천만 − 배제 1천만) × 20%
  assert.equal(result.localPayable, 9_900_000); // 1천만 + 10만 − 20만
  assert.equal(result.unappropriatedTotal, 3_300_000);
  assert.equal(result.totalPayable, 71_200_000);
});

test("순손익액: 산출세액으로 법인세 등 계산", () => {
  const year = {
    ...emptyNetIncomeYear(),
    taxableIncome: "500000000",
    dividendExclusion: "10000000",
    fines: "1000000",
    entertainmentExcess: "4000000",
    computedTax: "75000000",
    creditsNonRural: "5000000",
    creditsRural: "10000000",
  };
  const result = netIncomeYear(year, 10000);
  // 총결정세액 6천만 + 농특세 2백만 + 지방소득세 750만 = 6,950만
  assert.equal(result.corporateTaxEtc, 69_500_000);
  assert.equal(result.additions, 510_000_000);
  assert.equal(result.deductions, 74_500_000);
  assert.equal(result.annualized, 435_500_000);
  assert.equal(result.perShare, 43_550);
});

test("순손익액: 12개월 미만 사업연도 연환산", () => {
  const year = { ...emptyNetIncomeYear(), taxableIncome: "90000000", taxMode: "direct" as const, months: "9" };
  assert.equal(netIncomeYear(year, 1000).annualized, 120_000_000);
});

const CONTEXT = { valuationDate: "2024-09-30", fiscalYearEndMonth: 12 };

test("예금 미수이자: 연이율·날짜로 자동 계산, 원천징수 15.4%", () => {
  const timeDeposit = {
    ...createAccount("asset", "정기예금", "deposit"),
    bookValue: "100000000",
    interestRatePercent: "3.65",
    interestFrom: "2024-06-02",
  };
  // 6/2 ~ 9/30 = 120일 → 100,000,000 × 3.65% × 120/365 = 1,200,000, 원천징수 168,000 + 16,800
  const computed = accountValue(timeDeposit, CONTEXT);
  assert.equal(computed.taxValue, 101_015_200);
  assert.equal(computed.fallbackToBook, false);

  // 직접 입력: 원천징수를 비우면 15.4% (140,000 + 14,000)
  const manual = { ...timeDeposit, interestManual: true, accruedInterest: "1000000" };
  assert.equal(accountValue(manual, CONTEXT).taxValue, 100_846_000);
  assert.equal(interestWithholding(1_234_567), 172_830 + 17_280);

  // 보통예금은 입력이 없어도 미수이자 0원(경고 없음), 정기예금은 입력이 없으면 경고
  const demand = accountValue({ ...createAccount("asset", "보통예금", "deposit"), bookValue: "5000000" }, CONTEXT);
  assert.equal(demand.taxValue, 5_000_000);
  assert.equal(demand.fallbackToBook, false);
  const missing = accountValue({ ...createAccount("asset", "정기예금", "deposit"), bookValue: "5000000" }, CONTEXT);
  assert.equal(missing.fallbackToBook, true);
});

test("계정 평가방법별 평가액", () => {
  const deposit = {
    ...createAccount("asset", "예금", "deposit"),
    bookValue: "200000000",
    interestManual: true,
    accruedInterest: "1000000",
    withholdingTax: "140000",
  };
  assert.equal(accountValue(deposit, CONTEXT).taxValue, 200_860_000); // + 1,000,000 − 140,000

  const zero = { ...createAccount("asset", "이연법인세자산", "zero"), bookValue: "50000000" };
  assert.equal(accountValue(zero, CONTEXT).diff, -50_000_000);

  const payable = {
    ...createAccount("liability", "미지급금", "unconfirmed"),
    bookValue: "100000000",
    unconfirmed: [{ id: "u", name: "미확정", amount: "20000000" }],
  };
  assert.equal(accountValue(payable, CONTEXT).taxValue, 80_000_000);

  const tax = { ...createAccount("liability", "당기법인세부채", "corporateTax"), bookValue: "60000000", corporateTax: TAX_INPUT };
  assert.equal(accountValue(tax, CONTEXT).taxValue, 71_200_000);

  // 근속 1,461일(2020-09-30~2024-09-30) ÷ 365 × (월급 300만 + 상여 600만/12)
  const severance = {
    ...createAccount("liability", "퇴직급여충당부채", "severance"),
    bookValue: "40000000",
    employees: [
      { id: "e", name: "직원", wage1: "3000000", wage2: "3000000", wage3: "3000000", annualBonus: "6000000", hireDate: "2020-09-30" },
    ],
  };
  assert.ok(Math.abs(accountValue(severance, CONTEXT).taxValue - (3_500_000 * 1461) / 365) < 0.01);
});

test("명세를 입력하지 않은 계정은 장부가액으로 평가", () => {
  for (const method of ["depreciation", "corporateTax", "severance"] as const) {
    const account = { ...createAccount("liability", "계정", method), bookValue: "1000000" };
    const value = accountValue(account, CONTEXT);
    assert.equal(value.taxValue, 1_000_000);
    assert.equal(value.fallbackToBook, true);
  }
});

// 자산 15억, 부채 5억, 3개년 순손익액 각 3억, 발행주식 1만 주
function simpleState(): ValuationState {
  const state = createInitialState();
  state.basic = { ...state.basic, totalShares: "10000", businessStartDate: "2010-01-01", valuationDate: "2024-09-30" };
  state.accounts = [
    { ...createAccount("asset", "자산", "book"), bookValue: "1500000000" },
    { ...createAccount("liability", "부채", "book"), bookValue: "500000000" },
  ];
  const year = { ...emptyNetIncomeYear(), taxableIncome: "300000000", taxMode: "direct" as const };
  state.netIncome = [{ ...year }, { ...year }, { ...year }];
  return state;
}

test("전체 계산: 일반법인 3:2 가중평균", () => {
  const result = calculateValuation(simpleState());
  assert.equal(result.netAsset.beforeGoodwill, 1_000_000_000);
  // 영업권: (3억 × 50% − 10억 × 10%) = 5천만의 5년 현재가치(10%) = 189,539,338
  assert.equal(result.goodwill.presentValue, 189_539_338);
  assert.equal(result.netAsset.netAssetValue, 1_189_539_338);
  assert.equal(result.perShare.byNetIncome, 300_000); // 30,000 ÷ 10%
  assert.equal(result.perShare.byNetAsset, 118_953);
  assert.equal(result.perShare.weighted, 227_581); // 300,000 × 0.6 + 118,953 × 0.4
  assert.equal(result.perShare.floor, 95_162);
  assert.equal(result.perShare.final, 227_581);
  assert.equal(result.totalValue, 2_275_810_000);
});

test("최대주주 할증 20% (중소기업이 아닌 경우)", () => {
  const state = simpleState();
  state.judgment = { ...state.judgment, isMajorShareholder: true, isSmallBusiness: false };
  const result = calculateValuation(state);
  assert.equal(result.perShare.premiumRate, 0.2);
  assert.equal(result.perShare.final, 273_097); // 227,581 × 1.2
});

test("사업개시 3년 미만: 순자산가치만 적용하고 영업권 미합산", () => {
  const state = simpleState();
  state.basic.businessStartDate = "2022-10-01";
  const result = calculateValuation(state);
  assert.equal(result.method.weights, "netAssetOnly");
  assert.equal(result.netAsset.goodwillApplied, 0);
  assert.equal(result.perShare.final, 100_000);
});

test("사업개시 후 정확히 3년이 된 날은 3년 미만이 아님", () => {
  const state = simpleState();
  state.basic.businessStartDate = "2021-09-30";
  assert.equal(calculateValuation(state).method.isUnder3Years, false);
});

test("부동산과다보유법인: 50% 초과는 2:3, 80% 이상은 순자산가치만", () => {
  const heavy = simpleState();
  // 부동산 9억 ÷ 조정 후 총자산(15억 − 장부 토지 7억 + 9억 = 17억) = 52.9%
  heavy.judgment.realEstateLand = "900000000";
  heavy.judgment.deductLand = "700000000";
  const heavyResult = calculateValuation(heavy);
  assert.equal(heavyResult.method.weights, "2:3");
  assert.equal(heavyResult.perShare.weighted, Math.trunc(300_000 * 0.4 + 118_953 * 0.6));

  const over80 = simpleState();
  over80.judgment.realEstateLand = "1300000000";
  over80.judgment.deductLand = "1300000000"; // 13억 ÷ 15억 = 86.7%
  const over80Result = calculateValuation(over80);
  assert.equal(over80Result.method.weights, "netAssetOnly");
  assert.equal(over80Result.netAsset.goodwillApplied, 0);
});

test("3개년 연속 결손이면 순자산가치만 적용하고 할증도 제외", () => {
  const state = simpleState();
  state.judgment = { ...state.judgment, isMajorShareholder: true, isSmallBusiness: false };
  state.netIncome = state.netIncome.map((year) => ({ ...year, taxableIncome: "-100000000" })) as ValuationState["netIncome"];
  const result = calculateValuation(state);
  assert.equal(result.method.deficit3y, true);
  assert.equal(result.perShare.byNetIncome, 0);
  assert.equal(result.perShare.premiumRate, 0);
  assert.equal(result.perShare.final, 100_000);
});

test("순자산가액이 음수이면 0원으로 평가", () => {
  // 자기자본 −5억, 영업권 = 5백만(1천만 × 50%)의 5년 현재가치 18,953,933 → 합계가 음수이므로 0
  const state = simpleState();
  state.accounts[1].bookValue = "2000000000";
  state.netIncome = state.netIncome.map((year) => ({ ...year, taxableIncome: "10000000" })) as ValuationState["netIncome"];
  const result = calculateValuation(state);
  assert.equal(result.goodwill.presentValue, 18_953_933);
  assert.equal(result.netAsset.netAssetValue, 0);
  assert.equal(result.perShare.byNetAsset, 0);
});

test("가중평균이 순자산가치의 80%에 못 미치면 80%를 적용", () => {
  const state = simpleState();
  state.netIncome = state.netIncome.map((year) => ({ ...year, taxableIncome: "10000000" })) as ValuationState["netIncome"];
  const result = calculateValuation(state);
  // 순손익가치 10,000 / 순자산가치 100,000(영업권 음수 → 0) → 가중 46,000 < 하한 80,000
  assert.equal(result.perShare.weighted, 46_000);
  assert.equal(result.perShare.final, 80_000);
});

test("새 평가 유형별 평가액", () => {
  const make = (side: Side, method: ValuationMethod, book: string, extra: Partial<Account>): Account => ({
    ...createAccount(side, "계정", method),
    bookValue: book,
    ...extra,
  });
  const v = (account: Account) => accountValue(account, CONTEXT);

  // 채권: 회수불능액 차감 / 5년 초과면 현재가치 기준
  assert.equal(v(make("asset", "receivable", "1000000", { uncollectible: "200000" })).taxValue, 800000);
  assert.equal(v(make("asset", "receivable", "1000000", { over5Years: true, presentValue: "700000" })).taxValue, 700000);
  assert.equal(v(make("asset", "receivable", "1000000", { over5Years: true })).fallbackToBook, true);

  // 토지·건물: 시가 우선 → 기준시가 → 장부가액보다 작으면 장부가액
  assert.equal(v(make("asset", "realEstate", "500", { marketValue: "900", standardValue: "600" })).taxValue, 900);
  assert.equal(v(make("asset", "realEstate", "500", { standardValue: "600" })).taxValue, 600);
  assert.equal(v(make("asset", "realEstate", "500", { standardValue: "400" })).taxValue, 500);
  assert.equal(v(make("asset", "realEstate", "500", { standardValue: "400", justifiedBelowBook: true })).taxValue, 400);
  assert.equal(v(make("asset", "realEstate", "500", {})).fallbackToBook, true);

  // 상장주식, 재고자산, 선급비용
  assert.equal(v(make("asset", "listedStock", "0", { avgPrice: "12500", shareCount: "100" })).taxValue, 1250000);
  assert.equal(v(make("asset", "inventory", "800", {})).taxValue, 800);
  assert.equal(v(make("asset", "inventory", "800", { disposalValue: "650" })).taxValue, 650);
  assert.equal(v(make("asset", "prepaidExpense", "300", { expensedAmount: "120" })).taxValue, 180);

  // 차입금: 미지급이자 가산 / 충당부채: 확정분만 (비우면 장부가액 + 경고)
  assert.equal(v(make("liability", "borrowing", "10000", { accruedInterest: "250" })).taxValue, 10250);
  assert.equal(v(make("liability", "provision", "5000", { confirmedAmount: "0" })).taxValue, 0);
  assert.equal(v(make("liability", "provision", "5000", {})).fallbackToBook, true);

  // 장부가액 그대로: 평가액을 직접 넣으면 그 값 사용
  assert.equal(v(make("asset", "book", "100", {})).taxValue, 100);
  assert.equal(v(make("asset", "book", "100", { manualValue: "90" })).taxValue, 90);
});
