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
  deposit: "예금",
  receivable: "채권",
  realEstate: "토지·건물",
  listedStock: "상장주식",
  manual: "비상장주식 등",
  depreciation: "감가상각자산",
  inventory: "재고자산",
  prepaidExpense: "선급비용",
  unconfirmed: "확정 채무",
  borrowing: "차입금",
  provision: "충당부채·미지급비용",
  corporateTax: "법인세",
  severance: "퇴직급여",
  zero: "0원 처리",
  book: "장부가액 그대로",
};

// 유형별 평가 원칙 (화면 안내 문구)
export const METHOD_DESCRIPTIONS: Record<ValuationMethod, string> = {
  deposit:
    "예입총액에 평가기준일까지의 미수이자를 더하고 원천징수세액(15.4%)을 뺀 금액으로 평가합니다. 보통예금처럼 수시로 넣고 빼는 예금은 이자가 미미해 0원으로 보고, 정기예금·적금은 연이율과 날짜만 넣으면 계산해 드려요.",
  receivable:
    "회수기간이 5년 이내면 장부가액으로, 5년을 넘으면 현재가치로 평가합니다. 평가기준일 현재 회수할 수 없는 금액은 빼세요.",
  realEstate:
    "시가로 평가하고, 시가가 없으면 기준시가(공시지가·기준시가)로 평가합니다. 그 금액이 장부가액보다 작으면 장부가액으로 합니다(정당한 사유가 있으면 예외).",
  listedStock: "평가기준일 전후 각 2개월간 최종시세가액의 평균액에 보유 주식 수를 곱해 평가합니다.",
  manual: "비상장주식·출자금 등은 해당 법인을 따로 평가한 금액을 입력하세요.",
  depreciation: "자산별로 세법상 상각방법에 따라 다시 계산한 장부가액으로 평가합니다.",
  inventory: "처분할 때 받을 수 있는 예상가액으로 평가하고, 알 수 없으면 장부가액으로 합니다.",
  prepaidExpense: "평가기준일 현재 비용으로 확정된 금액은 자산에서 뺍니다.",
  unconfirmed: "평가기준일 현재 지급의무가 확정된 금액만 부채로 인정합니다. 확정되지 않은 금액을 적어 빼세요.",
  borrowing: "원금에 평가기준일까지 발생한 미지급이자를 더한 금액으로 평가합니다.",
  provision: "충당부채·미지급비용 중 평가기준일 현재 지급의무가 확정된 금액만 부채로 인정합니다.",
  corporateTax: "평가기준일까지 발생한 소득에 대해 실제로 납부해야 할 법인세·지방소득세·농어촌특별세로 평가합니다.",
  severance:
    "평가기준일 현재 임직원 전원이 퇴직할 경우 지급할 퇴직금 추계액으로 평가합니다. 확정기여형(DC) 가입자는 제외합니다.",
  zero: "이연법인세·사용권자산·리스부채처럼 세무상 인정되지 않는 자산·부채는 0원으로 평가합니다.",
  book: "장부가액을 상증세법상 평가액으로 봅니다. 다르게 평가해야 하면 평가액을 직접 입력하세요.",
};

// 화면에 보여줄 순서 (입력이 필요한 유형 먼저, 0원·그대로는 마지막)
export const METHODS_BY_SIDE: Record<Side, ValuationMethod[]> = {
  asset: ["deposit", "receivable", "realEstate", "listedStock", "manual", "depreciation", "inventory", "prepaidExpense", "zero", "book"],
  liability: ["unconfirmed", "borrowing", "provision", "corporateTax", "severance", "zero", "book"],
};

export interface AccountPreset {
  side: Side;
  name: string;
  method: ValuationMethod;
}

// "계정 추가"에서 고를 수 있는 대표 계정과 기본 평가 유형
export const ACCOUNT_PRESETS: AccountPreset[] = [
  { side: "asset", name: "현금및현금성자산", method: "deposit" },
  { side: "asset", name: "매출채권", method: "receivable" },
  { side: "asset", name: "미수금", method: "receivable" },
  { side: "asset", name: "대여금", method: "receivable" },
  { side: "asset", name: "미수수익", method: "book" },
  { side: "asset", name: "선급금", method: "book" },
  { side: "asset", name: "선급비용", method: "prepaidExpense" },
  { side: "asset", name: "선급법인세", method: "book" },
  { side: "asset", name: "계약자산", method: "book" },
  { side: "asset", name: "재고자산", method: "inventory" },
  { side: "asset", name: "상장주식", method: "listedStock" },
  { side: "asset", name: "비상장주식·출자금", method: "manual" },
  { side: "asset", name: "토지", method: "realEstate" },
  { side: "asset", name: "건물", method: "realEstate" },
  { side: "asset", name: "유형자산(비품 등)", method: "depreciation" },
  { side: "asset", name: "무형자산(소프트웨어 등)", method: "depreciation" },
  { side: "asset", name: "임차보증금", method: "receivable" },
  { side: "asset", name: "이연법인세자산", method: "zero" },
  { side: "asset", name: "사용권자산", method: "zero" },
  { side: "asset", name: "기타 자산", method: "book" },
  { side: "liability", name: "매입채무", method: "unconfirmed" },
  { side: "liability", name: "미지급금", method: "unconfirmed" },
  { side: "liability", name: "미지급비용", method: "provision" },
  { side: "liability", name: "예수금", method: "book" },
  { side: "liability", name: "부가세예수금", method: "book" },
  { side: "liability", name: "당기법인세부채", method: "corporateTax" },
  { side: "liability", name: "차입금", method: "borrowing" },
  { side: "liability", name: "선수금·계약부채", method: "book" },
  { side: "liability", name: "충당부채", method: "provision" },
  { side: "liability", name: "퇴직급여충당부채", method: "severance" },
  { side: "liability", name: "장기미지급금", method: "provision" },
  { side: "liability", name: "리스부채", method: "zero" },
  { side: "liability", name: "이연법인세부채", method: "zero" },
  { side: "liability", name: "기타 부채", method: "book" },
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
    withholdingTax: "",
    interestRatePercent: "",
    interestFrom: "",
    interestManual: false,
    uncollectible: "",
    over5Years: false,
    presentValue: "",
    marketValue: "",
    standardValue: "",
    justifiedBelowBook: false,
    avgPrice: "",
    shareCount: "",
    disposalValue: "",
    expensedAmount: "",
    confirmedAmount: "",
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
  return {
    basic: {
      companyName: "",
      parValue: "",
      totalShares: "",
      businessStartDate: "",
      valuationDate: "",
      fiscalYearEndMonth: "12",
    },
    accounts: [],
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
