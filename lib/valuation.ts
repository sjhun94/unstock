// 비상장주식 보충적 평가 (상속세 및 증여세법 시행령 제54조, 제53조 기준)

export interface ValuationInput {
  totalShares: number; // 발행주식총수
  totalAssets: number; // 자산총액
  totalLiabilities: number; // 부채총액
  goodwill: number; // 영업권 상당액 (자산에 미반영분)
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
  netAssetValuePerShare: number; // 1주당 순자산가치
  isUnder3YearsSinceStart: boolean; // 사업개시 후 3년 미만 여부 (순자산가치만으로 평가)
  weightedValuePerShare: number; // 가중평균(또는 순자산가치 단독) 1주당 가액, 하한 적용 전
  netAssetFloorApplied: boolean; // 순자산가치 80% 하한 적용 여부
  baseValuePerShare: number; // 하한 적용 후, 할증 적용 전 1주당 가액
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
    goodwill,
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

  const perShareProfit1 = profitYear1 / totalShares;
  const perShareProfit2 = profitYear2 / totalShares;
  const perShareProfit3 = profitYear3 / totalShares;

  const weightedPerShareProfit =
    (perShareProfit1 * 3 + perShareProfit2 * 2 + perShareProfit3 * 1) / 6;

  const netProfitValuePerShare = weightedPerShareProfit / capitalizationRate;
  const netAssetValuePerShare = (totalAssets - totalLiabilities + goodwill) / totalShares;

  const isUnder3YearsSinceStart =
    businessStartDate !== "" && valuationDate !== "" && yearsBetween(businessStartDate, valuationDate) < 3;

  const profitWeight = isRealEstateHeavy ? 2 : 3;
  const assetWeight = isRealEstateHeavy ? 3 : 2;

  const weightedValuePerShare = isUnder3YearsSinceStart
    ? netAssetValuePerShare
    : (netProfitValuePerShare * profitWeight + netAssetValuePerShare * assetWeight) / 5;

  const netAssetFloor = netAssetValuePerShare * 0.8;
  const netAssetFloorApplied = weightedValuePerShare < netAssetFloor;
  const baseValuePerShare = netAssetFloorApplied ? netAssetFloor : weightedValuePerShare;

  const premiumApplied = isMajorShareholder && !isSmallBusiness;
  const premiumRate = premiumApplied ? 0.2 : 0;
  const finalValuePerShare = baseValuePerShare * (1 + premiumRate);

  return {
    netProfitValuePerShare,
    netAssetValuePerShare,
    isUnder3YearsSinceStart,
    weightedValuePerShare,
    netAssetFloorApplied,
    baseValuePerShare,
    premiumApplied,
    premiumRate,
    finalValuePerShare,
    totalCompanyValue: finalValuePerShare * totalShares,
  };
}
