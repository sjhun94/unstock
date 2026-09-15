// 비상장주식 보충적 평가 (상속세 및 증여세법 시행령 제54조, 제55조, 제56조, 제59조 기준)

export interface ValuationInput {
  totalShares: number; // 발행주식총수
  totalAssets: number; // 세법상 자산총액 (영업권 제외)
  totalLiabilities: number; // 세법상 부채총액
  purchasedGoodwillDeduction: number; // 매입한 영업권 등 이미 자산에 계상된 무체재산권 차감액
  isRealEstateHeavy: boolean; // 부동산 등 자산 비율 50% 이상 법인 여부
  profitYear1: number; // 최근 사업연도(1년 전) 순손익액
  profitYear2: number; // 2년 전 순손익액
  profitYear3: number; // 3년 전 순손익액
  capitalizationRate: number; // 순손익가치환원율 (예: 0.1 = 10%)
  businessStartDate: string; // 사업개시일 (YYYY-MM-DD)
  valuationDate: string; // 평가기준일 (YYYY-MM-DD)
  isMajorShareholder: boolean; // 최대주주 등 해당 여부
  majorShareholderRatio: number; // 최대주주 등 지분율 (%, 참고용)
  isSmallBusiness: boolean; // 중소기업(할증평가 면제) 해당 여부
}

export interface ValuationResult {
  netProfitValuePerShare: number; // 1주당 순손익가치
  netAssetValuePerShare: number; // 1주당 순자산가치 (영업권 포함)
  computedGoodwill: number; // 계산된 영업권 상당액 (총액)
  isUnder3YearsSinceStart: boolean; // 사업개시 후 3년 미만 여부 (순자산가치만으로 평가, 영업권 미반영)
  weightedValuePerShare: number; // 가중평균(또는 순자산가치 단독) 1주당 가액, 하한 적용 전
  netAssetFloorApplied: boolean; // 순자산가치 80% 하한 적용 여부
  baseValuePerShare: number; // 하한 적용 후, 할증 적용 전 1주당 가액
  isThreeYearDeficit: boolean; // 최근 3개년 연속 결손법인 여부 (할증평가 면제 사유)
  premiumApplied: boolean; // 최대주주 등 할증평가 적용 여부
  premiumRate: number; // 적용된 할증률 (예: 0.2)
  finalValuePerShare: number; // 최종 1주당 평가액
  totalCompanyValue: number; // 총 평가액
}

function yearsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return (end - start) / (1000 * 60 * 60 * 24 * 365.25);
}

export function calculateValuation(input: ValuationInput): ValuationResult {
  const {
    totalShares,
    totalAssets,
    totalLiabilities,
    purchasedGoodwillDeduction,
    isRealEstateHeavy,
    profitYear1,
    profitYear2,
    profitYear3,
    capitalizationRate,
    businessStartDate,
    valuationDate,
    isMajorShareholder,
    isSmallBusiness,
  } = input;

  const isUnder3YearsSinceStart =
    businessStartDate !== "" && valuationDate !== "" && yearsBetween(businessStartDate, valuationDate) < 3;

  // 1주당 순손익가치 (시행령 제56조): 가중평균이 0 미만이면 0으로 floor.
  const perShareProfit1 = profitYear1 / totalShares;
  const perShareProfit2 = profitYear2 / totalShares;
  const perShareProfit3 = profitYear3 / totalShares;
  const weightedPerShareProfit = Math.max(
    (perShareProfit1 * 3 + perShareProfit2 * 2 + perShareProfit3 * 1) / 6,
    0,
  );
  const netProfitValuePerShare = weightedPerShareProfit / capitalizationRate;

  // 영업권 상당액 (시행령 제59조 제2항): 여기서는 floor 없이 원 금액 그대로 가중평균.
  const weightedTotalProfit = (profitYear1 * 3 + profitYear2 * 2 + profitYear3 * 1) / 6;
  const netAssetBeforeGoodwill = totalAssets - totalLiabilities;
  const selfCapitalReturn = netAssetBeforeGoodwill < 0 ? 0 : netAssetBeforeGoodwill * 0.1;
  const excessProfit = weightedTotalProfit * 0.5 - selfCapitalReturn;
  let goodwillPresentValue = 0;
  for (let year = 1; year <= 5; year++) {
    goodwillPresentValue += excessProfit / Math.pow(1.1, year);
  }
  goodwillPresentValue = Math.floor(goodwillPresentValue);
  const rawGoodwill = goodwillPresentValue - purchasedGoodwillDeduction;
  // 사업개시 후 3년 미만 법인은 영업권을 순자산가액에 반영하지 않음 (시행령 제55조 제3항 제2호).
  const computedGoodwill = isUnder3YearsSinceStart ? 0 : Math.max(rawGoodwill, 0);

  const netAssetValuePerShare = (netAssetBeforeGoodwill + computedGoodwill) / totalShares;

  const profitWeight = isRealEstateHeavy ? 2 : 3;
  const assetWeight = isRealEstateHeavy ? 3 : 2;

  const weightedValuePerShare = isUnder3YearsSinceStart
    ? netAssetValuePerShare
    : (netProfitValuePerShare * profitWeight + netAssetValuePerShare * assetWeight) / 5;

  const netAssetFloor = netAssetValuePerShare * 0.8;
  const netAssetFloorApplied = weightedValuePerShare < netAssetFloor;
  const baseValuePerShare = netAssetFloorApplied ? netAssetFloor : weightedValuePerShare;

  // 최근 3개년 연속 결손법인은 최대주주 할증평가에서 제외됨 (상증세법 집행기준 63-53-5).
  const isThreeYearDeficit = profitYear1 < 0 && profitYear2 < 0 && profitYear3 < 0;
  const premiumApplied = isMajorShareholder && !isSmallBusiness && !isThreeYearDeficit;
  const premiumRate = premiumApplied ? 0.2 : 0;
  const finalValuePerShare = baseValuePerShare * (1 + premiumRate);

  return {
    netProfitValuePerShare,
    netAssetValuePerShare,
    computedGoodwill,
    isUnder3YearsSinceStart,
    weightedValuePerShare,
    netAssetFloorApplied,
    baseValuePerShare,
    isThreeYearDeficit,
    premiumApplied,
    premiumRate,
    finalValuePerShare,
    totalCompanyValue: finalValuePerShare * totalShares,
  };
}
