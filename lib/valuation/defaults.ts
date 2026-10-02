// 초기 상태와 계정과목 프리셋
import type {
  Account,
  CorporateTaxInput,
  EmployeeRow,
  FixedAssetRow,
  NetIncomeYear,
  ReserveRow,
  Side,
  TaxCreditRow,
  UnconfirmedRow,
  ValuationMethod,
  ValuationState,
} from "./types.ts";

let idCounter = 0;
export function newId(): string {
  idCounter += 1;
  return `${Date.now().toString(36)}-${idCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

export const METHOD_LABELS: Record<ValuationMethod, string> = {
  book: "장부가액 그대로",
  manual: "평가액 직접 입력",
  zero: "0원 (세무상 인정되지 않음)",
  deposit: "예금 (미수이자 − 원천징수세액 반영)",
  depreciation: "감가상각 세무상 재계산",
  unconfirmed: "미확정 부채 차감",
  corporateTax: "법인세 등 납부할 세액 계산",
  severance: "퇴직급여 추계액",
};

export const METHODS_BY_SIDE: Record<Side, ValuationMethod[]> = {
  asset: ["book", "manual", "zero", "deposit", "depreciation"],
  liability: ["book", "manual", "zero", "unconfirmed", "corporateTax", "severance"],
};

export interface AccountPreset {
  side: Side;
  name: string;
  method: ValuationMethod;
  hint: string; // 평가 원칙 요약
}

export const ACCOUNT_PRESETS: AccountPreset[] = [
  { side: "asset", name: "현금및현금성자산", method: "deposit", hint: "예입총액에 평가기준일까지의 미수이자를 더하고 원천징수세액을 뺍니다." },
  { side: "asset", name: "매출채권", method: "book", hint: "회수기간 5년 이내이면 장부가액. 회수 불가능한 금액은 직접 입력으로 제외하세요." },
  { side: "asset", name: "미수금", method: "book", hint: "회수기간 5년 이내이면 장부가액으로 평가합니다." },
  { side: "asset", name: "미수수익", method: "manual", hint: "평가기준일까지 발생한 이자 상당액으로 평가합니다." },
  { side: "asset", name: "선급금", method: "book", hint: "회수기간 5년 이내이면 장부가액으로 평가합니다." },
  { side: "asset", name: "선급비용", method: "book", hint: "평가기준일 현재 비용으로 확정된 금액은 자산에서 제외합니다." },
  { side: "asset", name: "선급법인세", method: "manual", hint: "미지급법인세 계산에 반영했다면 0으로 평가합니다." },
  { side: "asset", name: "계약자산", method: "book", hint: "세무조정과 일치하도록 평가합니다." },
  { side: "asset", name: "재고자산", method: "book", hint: "처분 예상가액을 알기 어려우면 장부가액으로 평가합니다." },
  { side: "asset", name: "금융자산(주식 등)", method: "manual", hint: "상장주식은 평가기준일 전후 2개월 종가평균 등으로 별도 평가합니다." },
  { side: "asset", name: "토지", method: "manual", hint: "시가 또는 기준시가(개별공시지가)로 평가하되, 장부가액보다 작으면 장부가액으로 합니다." },
  { side: "asset", name: "건물", method: "manual", hint: "시가 또는 기준시가로 평가하되, 장부가액보다 작으면 장부가액으로 합니다." },
  { side: "asset", name: "유형자산(비품 등)", method: "depreciation", hint: "장부금액은 취득가액에서 감가상각누계액을 뺀 금액. 자산별로 세법상 상각방법으로 다시 계산합니다." },
  { side: "asset", name: "무형자산(소프트웨어 등)", method: "depreciation", hint: "자산별로 세법상 상각방법으로 다시 계산한 장부가액으로 평가합니다." },
  { side: "asset", name: "임차보증금", method: "book", hint: "회수기간 5년 이내이면 장부가액으로 평가합니다." },
  { side: "asset", name: "이연법인세자산", method: "zero", hint: "세무상 자산으로 인정되지 않아 0으로 평가합니다." },
  { side: "asset", name: "사용권자산", method: "zero", hint: "세무상 부인되는 자산이라 0으로 평가합니다." },
  { side: "asset", name: "기타 자산", method: "book", hint: "평가방법을 선택하세요." },
  { side: "liability", name: "미지급금", method: "unconfirmed", hint: "평가기준일 현재 확정된 부채만 인정합니다. 확정되지 않은 금액을 명세에 적어 차감하세요." },
  { side: "liability", name: "미지급비용", method: "manual", hint: "연차충당부채처럼 확정되지 않은 부채는 제외한 금액을 입력합니다." },
  { side: "liability", name: "예수금", method: "book", hint: "장부가액으로 평가합니다." },
  { side: "liability", name: "부가세예수금", method: "book", hint: "장부가액으로 평가합니다." },
  { side: "liability", name: "당기법인세부채", method: "corporateTax", hint: "평가기준일까지 발생한 소득에 대해 실제 납부해야 할 법인세·지방소득세·농어촌특별세로 평가합니다." },
  { side: "liability", name: "차입금", method: "book", hint: "원금에 평가기준일까지의 미지급이자를 더한 금액으로 평가합니다." },
  { side: "liability", name: "선수금·계약부채", method: "book", hint: "장부가액으로 평가합니다." },
  { side: "liability", name: "충당부채", method: "manual", hint: "확정된 부채만 인정합니다. 충당금·준비금은 원칙적으로 부채에서 제외합니다." },
  { side: "liability", name: "퇴직급여충당부채", method: "severance", hint: "임직원 전원이 퇴직할 경우 지급할 퇴직금 추계액으로 평가합니다. 확정기여형(DC)은 추계액이 없습니다." },
  { side: "liability", name: "장기미지급금", method: "manual", hint: "확정되지 않은 부채는 제외한 금액을 입력합니다." },
  { side: "liability", name: "리스부채", method: "zero", hint: "세무상 부인되는 부채라 0으로 평가합니다." },
  { side: "liability", name: "이연법인세부채", method: "zero", hint: "세무상 부채로 인정되지 않아 0으로 평가합니다." },
  { side: "liability", name: "기타 부채", method: "book", hint: "평가방법을 선택하세요." },
];

// 처음 화면에 기본으로 보여줄 계정과목
const DEFAULT_ACCOUNT_NAMES = [
  "현금및현금성자산",
  "매출채권",
  "선급금",
  "선급비용",
  "계약자산",
  "유형자산(비품 등)",
  "무형자산(소프트웨어 등)",
  "임차보증금",
  "이연법인세자산",
  "미지급금",
  "예수금",
  "부가세예수금",
  "당기법인세부채",
  "미지급비용",
  "퇴직급여충당부채",
  "장기미지급금",
];

export function emptyCorporateTax(): CorporateTaxInput {
  return {
    computedTax: "",
    localComputedTax: "",
    credits: [],
    minimumTax: "",
    penaltyTax: "",
    interimPrepaid: "",
    withheld: "",
    additionalPayment: "",
    landTransferTax: "",
    localPenaltyTax: "",
    localWithheld: "",
    unappropriatedIncomeTax: "",
  };
}

export function createAccount(side: Side, name: string, method: ValuationMethod): Account {
  return {
    id: newId(),
    side,
    name,
    bookValue: "",
    method,
    manualValue: "",
    accruedInterest: "",
    withholdingRatePercent: "14",
    fixedAssets: [],
    unconfirmed: [],
    corporateTax: emptyCorporateTax(),
    employees: [],
  };
}

export function createFixedAsset(): FixedAssetRow {
  return { id: newId(), name: "", acquisitionDate: "", cost: "", usefulLifeYears: "5", method: "declining", rate: "" };
}

export function createUnconfirmed(): UnconfirmedRow {
  return { id: newId(), name: "", amount: "" };
}

export function createTaxCredit(): TaxCreditRow {
  return { id: newId(), name: "", amount: "", minimumTaxApplies: true, ruralTaxApplies: false, excluded: "" };
}

export function createEmployee(): EmployeeRow {
  return { id: newId(), name: "", wage1: "", wage2: "", wage3: "", annualBonus: "", hireDate: "" };
}

export function createReserve(): ReserveRow {
  return { id: newId(), name: "", reserveAmount: "", includeAmount: "" };
}

export function emptyNetIncomeYear(): NetIncomeYear {
  return {
    taxableIncome: "",
    refundInterest: "",
    dividendExclusion: "",
    donationCarryover: "",
    vehicleCarryover: "",
    fxGain: "",
    fines: "",
    publicCharges: "",
    nonBusiness: "",
    vehicleDisallowed: "",
    withholdingDefault: "",
    donationExcess: "",
    entertainmentExcess: "",
    interestDisallowed: "",
    excessiveExpenses: "",
    depreciationShortfall: "",
    fxLoss: "",
    taxMode: "computed",
    taxDirect: "",
    computedTax: "",
    creditsNonRural: "",
    creditsRural: "",
    capitalChangeEffect: "",
    months: "12",
    shares: "",
  };
}

export function createInitialState(): ValuationState {
  const accounts = DEFAULT_ACCOUNT_NAMES.map((name) => {
    const preset = ACCOUNT_PRESETS.find((p) => p.name === name)!;
    return createAccount(preset.side, preset.name, preset.method);
  });

  return {
    basic: {
      companyName: "",
      parValue: "",
      totalShares: "",
      businessStartDate: "",
      valuationDate: "",
      fiscalYearEndMonth: "12",
    },
    accounts,
    adjustments: { reserves: [], liabilityTaxEtc: "", purchasedGoodwill: "", capitalizationRatePercent: "10" },
    netIncome: [emptyNetIncomeYear(), emptyNetIncomeYear(), emptyNetIncomeYear()],
    judgment: {
      stockRatioPercent: "",
      liquidation: false,
      dormant: false,
      deficit3y: false,
      limitedLife: false,
      reserveAdjust: "",
      deductLand: "",
      deductBuilding: "",
      deductIntangible: "",
      deductFinancial: "",
      realEstateLand: "",
      realEstateBuilding: "",
      realEstateStock: "",
      isMajorShareholder: false,
      isSmallBusiness: true,
      mergerCase: false,
      earlyNoProfit: false,
      liquidationConfirmed: false,
      otherExempt: false,
    },
  };
}
