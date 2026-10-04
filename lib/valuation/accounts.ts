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
  fallbackToBook: boolean; // 필요한 값이 비어 있어 장부가액으로 평가했는지
  note?: string; // 어떤 기준이 적용됐는지 (예: "기준시가가 장부가액보다 작아 장부가액 적용")
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

const filled = (value: string) => value.trim() !== "";

// 보통예금처럼 수시로 넣고 빼는 예금 (이자가 미미해 미수이자를 0원으로 봄)
export function isDemandDeposit(name: string): boolean {
  return /보통|당좌|요구불|입출금|MMDA|CMA|MMF|현금/i.test(name.replace(/\s/g, ""));
}

// 이자소득 원천징수: 법인세 14% + 지방소득세(그 10%) = 15.4%, 각각 10원 미만 버림
export function interestWithholding(interest: number): number {
  const floor10 = (value: number) => Math.floor(value / 10) * 10;
  const corporate = floor10(Math.max(interest, 0) * 0.14);
  return corporate + floor10(corporate * 0.1);
}

export type DepositInterestMode = "manual" | "computed" | "demand" | "missing";

export interface DepositInterest {
  mode: DepositInterestMode;
  interest: number; // 미수이자
  withholding: number; // 원천징수세액
  days: number | null; // 경과일수 (계산한 경우)
}

// 미수이자 = 예입액 × 연이율 × 경과일수 ÷ 365 (마지막으로 이자 받은 날 또는 가입일 ~ 평가기준일)
export function depositInterest(account: Account, book: number, valuationDate: string): DepositInterest {
  if (account.interestManual) {
    const interest = num(account.accruedInterest);
    const withholding = filled(account.withholdingTax) ? num(account.withholdingTax) : interestWithholding(interest);
    return { mode: "manual", interest, withholding, days: null };
  }
  const from = parseYmd(account.interestFrom);
  const valuation = parseYmd(valuationDate);
  if (filled(account.interestRatePercent) && from && valuation) {
    const days = Math.max(daysBetween(from, valuation), 0);
    const interest = Math.floor((book * num(account.interestRatePercent)) / 100 * days / 365);
    return { mode: "computed", interest, withholding: interestWithholding(interest), days };
  }
  return { mode: isDemandDeposit(account.name) ? "demand" : "missing", interest: 0, withholding: 0, days: null };
}

interface TaxValue {
  value: number;
  fallback?: boolean;
  note?: string;
}

// 토지·건물: 시가 → 없으면 기준시가 → 그 금액이 장부가액보다 작으면 장부가액 (정당한 사유가 있으면 예외)
function realEstateValue(account: Account, book: number): TaxValue {
  const basis = filled(account.marketValue) ? "시가" : filled(account.standardValue) ? "기준시가" : null;
  if (!basis) return { value: book, fallback: true };
  const assessed = num(basis === "시가" ? account.marketValue : account.standardValue);
  if (assessed < book && !account.justifiedBelowBook) {
    return { value: book, note: `${basis}가 장부가액보다 작아 장부가액을 적용했습니다.` };
  }
  return { value: assessed, note: `${basis}를 적용했습니다.` };
}

function taxValueOf(account: Account, book: number, context: AccountContext): TaxValue {
  switch (account.method) {
    case "deposit": {
      const { mode, interest, withholding, days } = depositInterest(account, book, context.valuationDate);
      const value = book + interest - withholding;
      if (mode === "computed") return { value, note: `${days}일분 미수이자를 더하고 원천징수세액(15.4%)을 뺐습니다.` };
      if (mode === "demand") return { value, note: "수시로 넣고 빼는 예금이라 미수이자를 0원으로 봤습니다." };
      if (mode === "missing") return { value, fallback: true };
      return { value };
    }
    case "receivable":
      if (account.over5Years) {
        if (!filled(account.presentValue)) return { value: book - num(account.uncollectible), fallback: true };
        return { value: num(account.presentValue) - num(account.uncollectible) };
      }
      return { value: book - num(account.uncollectible) };
    case "realEstate":
      return realEstateValue(account, book);
    case "listedStock":
      if (!filled(account.avgPrice) || !filled(account.shareCount)) return { value: book, fallback: true };
      return { value: num(account.avgPrice) * num(account.shareCount) };
    case "manual":
      if (!filled(account.manualValue)) return { value: book, fallback: true };
      return { value: num(account.manualValue) };
    case "depreciation": {
      if (account.fixedAssets.length === 0) return { value: book, fallback: true };
      const total = account.fixedAssets.reduce(
        (sum, asset) => sum + fixedAssetTaxValue(asset, context.valuationDate, context.fiscalYearEndMonth).taxBookValue,
        0,
      );
      return { value: total };
    }
    case "inventory":
      return filled(account.disposalValue) ? { value: num(account.disposalValue) } : { value: book };
    case "prepaidExpense":
      return { value: book - num(account.expensedAmount) };
    case "unconfirmed":
      return { value: book - account.unconfirmed.reduce((sum, row) => sum + num(row.amount), 0) };
    case "borrowing":
      return { value: book + num(account.accruedInterest) };
    case "provision":
      if (!filled(account.confirmedAmount)) return { value: book, fallback: true };
      return { value: num(account.confirmedAmount) };
    case "corporateTax":
      if (isCorporateTaxEmpty(account.corporateTax)) return { value: book, fallback: true };
      return { value: corporateTaxPayable(account.corporateTax).totalPayable };
    case "severance": {
      if (account.employees.length === 0) return { value: book, fallback: true };
      return { value: account.employees.reduce((sum, e) => sum + severanceEstimate(e, context.valuationDate), 0) };
    }
    case "zero":
      return { value: 0 };
    case "book":
      return filled(account.manualValue) ? { value: num(account.manualValue) } : { value: book };
  }
}

export function accountValue(account: Account, context: AccountContext): AccountValue {
  const book = num(account.bookValue);
  const { value, fallback = false, note } = taxValueOf(account, book, context);
  return { book, taxValue: value, diff: value - book, fallbackToBook: fallback, note };
}
