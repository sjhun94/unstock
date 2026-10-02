// 사업연도별 순손익액 (상증세법 시행령 제56조 제4항)
import { num, roundHalfAway } from "./num.ts";
import type { NetIncomeYear } from "./types.ts";

export interface NetIncomeYearResult {
  additions: number; // 각 사업연도 소득 + 가산 항목
  corporateTaxEtc: number; // 법인세 총결정세액 + 농어촌특별세 + 지방소득세
  deductions: number; // 차감 항목 (법인세 등 포함)
  beforeCapitalChange: number;
  afterCapitalChange: number;
  annualized: number; // 연환산 순손익액
  shares: number; // 사업연도말 주식수
  perShare: number; // 1주당 순손익액
}

export function corporateTaxEtc(year: NetIncomeYear): number {
  if (year.taxMode === "direct") return num(year.taxDirect);
  const computedTax = num(year.computedTax);
  const ruralCredits = num(year.creditsRural);
  const determinedTax = computedTax - num(year.creditsNonRural) - ruralCredits;
  return determinedTax + ruralCredits * 0.2 + roundHalfAway(computedTax * 0.1, -1);
}

export function netIncomeYear(year: NetIncomeYear, totalShares: number): NetIncomeYearResult {
  const additions =
    num(year.taxableIncome) +
    num(year.refundInterest) +
    num(year.dividendExclusion) +
    num(year.donationCarryover) +
    num(year.vehicleCarryover) +
    num(year.fxGain);

  const taxEtc = corporateTaxEtc(year);
  const deductions =
    num(year.fines) +
    num(year.publicCharges) +
    num(year.nonBusiness) +
    num(year.vehicleDisallowed) +
    num(year.withholdingDefault) +
    num(year.donationExcess) +
    num(year.entertainmentExcess) +
    num(year.interestDisallowed) +
    num(year.excessiveExpenses) +
    taxEtc +
    num(year.depreciationShortfall) +
    num(year.fxLoss);

  const beforeCapitalChange = additions - deductions;
  const afterCapitalChange = beforeCapitalChange + num(year.capitalChangeEffect);
  const months = num(year.months) > 0 ? num(year.months) : 12;
  const annualized = (afterCapitalChange * 12) / months;
  const shares = num(year.shares) > 0 ? num(year.shares) : totalShares;

  return {
    additions,
    corporateTaxEtc: taxEtc,
    deductions,
    beforeCapitalChange,
    afterCapitalChange,
    annualized,
    shares,
    perShare: shares > 0 ? annualized / shares : 0,
  };
}
