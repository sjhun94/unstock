// 감가상각자산의 세무상 장부가액 재계산
// 취득월부터 평가기준일이 속하는 달까지 사업연도별로 월할 상각하며,
// 내용연수가 끝나는 사업연도에는 비망가액 1,000원만 남깁니다.
import { monthIndex, num, parseYmd, roundHalfAway } from "./num.ts";
import type { DepreciationMethod, FixedAssetRow } from "./types.ts";

// 법인세법 시행규칙 별표 4 (감가상각자산의 상각률표) 중 내용연수 2~20년
const DECLINING_RATES: Record<number, number> = {
  2: 0.777, 3: 0.632, 4: 0.528, 5: 0.451, 6: 0.394, 7: 0.349, 8: 0.313, 9: 0.284, 10: 0.259,
  11: 0.239, 12: 0.221, 13: 0.206, 14: 0.193, 15: 0.182, 16: 0.171, 17: 0.162, 18: 0.154, 19: 0.146, 20: 0.14,
};
const STRAIGHT_RATES: Record<number, number> = {
  2: 0.5, 3: 0.333, 4: 0.25, 5: 0.2, 6: 0.166, 7: 0.142, 8: 0.125, 9: 0.111, 10: 0.1,
  11: 0.09, 12: 0.083, 13: 0.076, 14: 0.071, 15: 0.066, 16: 0.062, 17: 0.058, 18: 0.055, 19: 0.052, 20: 0.05,
};

const MEMO_VALUE = 1000;

export function standardRate(method: DepreciationMethod, years: number): number | null {
  const table = method === "declining" ? DECLINING_RATES : STRAIGHT_RATES;
  if (table[years] !== undefined) return table[years];
  if (method === "straight" && years > 0) return 1 / years;
  return null;
}

export interface DepreciationPeriod {
  months: number;
  depreciation: number;
  bookValue: number; // 기말 세무상 장부가액
}

export interface FixedAssetTaxValue {
  valid: boolean; // 계산에 필요한 값이 모두 입력되었는지
  cost: number;
  taxBookValue: number;
  periods: DepreciationPeriod[];
}

export function fixedAssetTaxValue(
  asset: FixedAssetRow,
  valuationDate: string,
  fiscalYearEndMonth: number,
): FixedAssetTaxValue {
  const cost = num(asset.cost);
  const life = num(asset.usefulLifeYears);
  const acquired = parseYmd(asset.acquisitionDate);
  const valuation = parseYmd(valuationDate);
  const rate = num(asset.rate) > 0 ? num(asset.rate) : standardRate(asset.method, life);

  if (!acquired || !valuation || cost <= 0 || life <= 0 || !rate) {
    return { valid: false, cost, taxBookValue: Math.max(cost, 0), periods: [] };
  }

  const totalMonths = Math.round(life * 12);
  const endIndex = monthIndex(valuation);
  const fyEndOffset = Math.min(Math.max(Math.round(fiscalYearEndMonth), 1), 12) - 1;

  let cursor = monthIndex(acquired);
  let used = 0;
  let book = cost;
  const periods: DepreciationPeriod[] = [];

  while (cursor <= endIndex && used < totalMonths) {
    let fiscalYearEnd = Math.floor(cursor / 12) * 12 + fyEndOffset;
    if (fiscalYearEnd < cursor) fiscalYearEnd += 12;
    const periodEnd = Math.min(fiscalYearEnd, endIndex);
    const months = Math.min(periodEnd - cursor + 1, totalMonths - used);
    const depreciable = Math.max(book - MEMO_VALUE, 0);
    const finishing = totalMonths - used - months <= 0;

    let depreciation: number;
    if (finishing) depreciation = depreciable;
    else if (asset.method === "declining") depreciation = roundHalfAway((book * rate * months) / 12);
    else depreciation = roundHalfAway((cost * rate * months) / 12);
    depreciation = Math.min(depreciation, depreciable);

    book -= depreciation;
    used += months;
    periods.push({ months, depreciation, bookValue: book });
    cursor = periodEnd + 1;
  }

  return { valid: true, cost, taxBookValue: book, periods };
}
