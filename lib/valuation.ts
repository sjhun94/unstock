// 비상장주식 보충적 평가 (상속세 및 증여세법 시행령 제54조 기준, 단순화 버전)

export interface ValuationInput {
  totalShares: number; // 발행주식총수
  profitYear1: number; // 최근 사업연도(1년 전) 순손익액
  profitYear2: number; // 2년 전 순손익액
  profitYear3: number; // 3년 전 순손익액
  capitalizationRate: number; // 순손익가치환원율 (예: 0.1 = 10%)
  totalAssets: number; // 자산총액
  totalLiabilities: number; // 부채총액
  isRealEstateHeavy: boolean; // 부동산 등 비율 50% 이상 법인 여부
}

export interface ValuationResult {
  netProfitValuePerShare: number; // 1주당 순손익가치
  netAssetValuePerShare: number; // 1주당 순자산가치
  weightedValuePerShare: number; // 가중평균 1주당 가액 (하한 적용 전)
  finalValuePerShare: number; // 최종 1주당 평가액 (하한 적용 후)
  totalCompanyValue: number; // 총 평가액
  netAssetFloorApplied: boolean; // 순자산가치 80% 하한이 적용됐는지 여부
}

export function calculateValuation(input: ValuationInput): ValuationResult {
  const {
    totalShares,
    profitYear1,
    profitYear2,
    profitYear3,
    capitalizationRate,
    totalAssets,
    totalLiabilities,
    isRealEstateHeavy,
  } = input;

  const perShareProfit1 = profitYear1 / totalShares;
  const perShareProfit2 = profitYear2 / totalShares;
  const perShareProfit3 = profitYear3 / totalShares;

  const weightedPerShareProfit =
    (perShareProfit1 * 3 + perShareProfit2 * 2 + perShareProfit3 * 1) / 6;

  const netProfitValuePerShare = weightedPerShareProfit / capitalizationRate;
  const netAssetValuePerShare = (totalAssets - totalLiabilities) / totalShares;

  const profitWeight = isRealEstateHeavy ? 2 : 3;
  const assetWeight = isRealEstateHeavy ? 3 : 2;

  const weightedValuePerShare =
    (netProfitValuePerShare * profitWeight + netAssetValuePerShare * assetWeight) / 5;

  const netAssetFloor = netAssetValuePerShare * 0.8;
  const netAssetFloorApplied = weightedValuePerShare < netAssetFloor;
  const finalValuePerShare = netAssetFloorApplied ? netAssetFloor : weightedValuePerShare;

  return {
    netProfitValuePerShare,
    netAssetValuePerShare,
    weightedValuePerShare,
    finalValuePerShare,
    totalCompanyValue: finalValuePerShare * totalShares,
    netAssetFloorApplied,
  };
}
