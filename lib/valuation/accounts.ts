// 계정과목별 상증세법상 평가액
import { corporateTaxPayable, isCorporateTaxEmpty } from "./corporateTax.ts";
import { fixedAssetTaxValue } from "./depreciation.ts";
import { daysBetween, num, parseYmd } from "./num.ts";
import type { Account, EmployeeRow } from "./types.ts";

export interface AccountContext {
  valuationDate: string;
  fiscalYearEndMonth: number;
}

export interface AccountValue {
  book: number; // 재무상태표상 금액
  taxValue: number; // 상증세법상 평가액
  diff: number; // 평가차액
  fallbackToBook: boolean; // 명세가 비어 있어 장부가액으로 평가했는지
}

// 일시퇴직기준 추계액 = (최근 3개월 평균급여 + 연간 상여 ÷ 12) × 근속연수
export function severanceEstimate(employee: EmployeeRow, valuationDate: string): number {
  const hired = parseYmd(employee.hireDate);
  const valuation = parseYmd(valuationDate);
  if (!hired || !valuation) return 0;
  const years = Math.max(daysBetween(hired, valuation), 0) / 365;
  const monthlyWage = (num(employee.wage1) + num(employee.wage2) + num(employee.wage3)) / 3;
  return (monthlyWage + num(employee.annualBonus) / 12) * years;
}

function taxValueOf(account: Account, book: number, context: AccountContext): { value: number; fallback: boolean } {
  switch (account.method) {
    case "book":
      return { value: book, fallback: false };
    case "manual":
      return { value: num(account.manualValue), fallback: false };
    case "zero":
      return { value: 0, fallback: false };
    case "deposit": {
      const accrued = num(account.accruedInterest);
      const withholding = Math.trunc(accrued * (num(account.withholdingRatePercent) / 100));
      return { value: book + accrued - withholding, fallback: false };
    }
    case "depreciation": {
      if (account.fixedAssets.length === 0) return { value: book, fallback: true };
      const total = account.fixedAssets.reduce(
        (sum, asset) =>
          sum + fixedAssetTaxValue(asset, context.valuationDate, context.fiscalYearEndMonth).taxBookValue,
        0,
      );
      return { value: total, fallback: false };
    }
    case "unconfirmed": {
      const excluded = account.unconfirmed.reduce((sum, row) => sum + num(row.amount), 0);
      return { value: book - excluded, fallback: false };
    }
    case "corporateTax": {
      if (isCorporateTaxEmpty(account.corporateTax)) return { value: book, fallback: true };
      return { value: corporateTaxPayable(account.corporateTax).totalPayable, fallback: false };
    }
    case "severance": {
      if (account.employees.length === 0) return { value: book, fallback: true };
      const total = account.employees.reduce(
        (sum, employee) => sum + severanceEstimate(employee, context.valuationDate),
        0,
      );
      return { value: total, fallback: false };
    }
  }
}

export function accountValue(account: Account, context: AccountContext): AccountValue {
  const book = num(account.bookValue);
  const { value, fallback } = taxValueOf(account, book, context);
  return { book, taxValue: value, diff: value - book, fallbackToBook: fallback };
}
