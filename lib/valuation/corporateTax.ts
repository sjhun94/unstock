// 평가기준일 현재 납부할 법인세 등 (당기법인세부채의 상증세법상 평가액)
// 법인세 차감납부할세액 + 법인지방소득세 + 미환류소득 법인세 + 농어촌특별세
import { num, roundHalfAway } from "./num.ts";
import type { CorporateTaxInput } from "./types.ts";

export interface CorporateTaxResult {
  creditLimit: number; // 최저한세 대상 세액공제 한도 (산출세액 − 최저한세)
  creditsSubject: number; // 최저한세 적용대상 공제·감면 합계
  creditsExempt: number; // 최저한세 적용제외 공제·감면 합계
  creditsExcluded: number; // 한도 초과로 배제되는 공제·감면
  nationalTax: number; // 가감계 (총부담세액)
  nationalPayable: number; // 법인세 차감납부할세액
  localPayable: number; // 법인지방소득세 차감납부할세액
  unappropriatedTotal: number; // 미환류소득 법인세 + 지방소득세
  ruralTax: number; // 농어촌특별세
  totalPayable: number;
}

export function isCorporateTaxEmpty(input: CorporateTaxInput): boolean {
  const { credits, ...amounts } = input;
  return credits.length === 0 && Object.values(amounts).every((value) => String(value).trim() === "");
}

export function corporateTaxPayable(input: CorporateTaxInput): CorporateTaxResult {
  const computedTax = num(input.computedTax);
  const sum = (rows: typeof input.credits, pick: (row: (typeof input.credits)[number]) => number) =>
    rows.reduce((total, row) => total + pick(row), 0);

  const creditLimit = Math.max(computedTax - num(input.minimumTax), 0);
  const creditsSubject = sum(input.credits, (row) => (row.minimumTaxApplies ? num(row.amount) : 0));
  const creditsExempt = sum(input.credits, (row) => (row.minimumTaxApplies ? 0 : num(row.amount)));
  const creditsSubjectUsed = Math.min(creditLimit, creditsSubject);
  const creditsExcluded = creditsSubject - creditsSubjectUsed;

  const nationalTax = computedTax - creditsSubjectUsed - creditsExempt + num(input.penaltyTax);
  const landTransferTax = num(input.landTransferTax);
  const nationalPayable = Math.max(
    nationalTax - (num(input.interimPrepaid) + num(input.withheld)) + num(input.additionalPayment) + landTransferTax,
    0,
  );

  const ruralBase =
    sum(input.credits, (row) => (row.ruralTaxApplies ? num(row.amount) : 0)) -
    sum(input.credits, (row) => (row.ruralTaxApplies ? num(row.excluded) : 0));
  const ruralTax = roundHalfAway(ruralBase * 0.2);

  const localLandTransfer = landTransferTax === 0 ? 0 : Math.max(Math.trunc(landTransferTax * 0.1), 0);
  const localPayable = Math.max(
    num(input.localComputedTax) + num(input.localPenaltyTax) + localLandTransfer - num(input.localWithheld),
    0,
  );

  const unappropriated = num(input.unappropriatedIncomeTax);
  const unappropriatedTotal = unappropriated + unappropriated * 0.1;

  return {
    creditLimit,
    creditsSubject,
    creditsExempt,
    creditsExcluded,
    nationalTax,
    nationalPayable,
    localPayable,
    unappropriatedTotal,
    ruralTax,
    totalPayable: nationalPayable + localPayable + unappropriatedTotal + ruralTax,
  };
}
