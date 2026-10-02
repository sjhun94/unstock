// 비상장주식 보충적 평가 — 입력 상태 타입
// 화면 입력값은 모두 문자열로 보관하고, 계산 시점에 숫자로 변환합니다.

export type Side = "asset" | "liability";

// 계정과목별 "상증세법상 평가액"을 구하는 방법
export type ValuationMethod =
  | "book" // 장부가액 그대로
  | "manual" // 평가액 직접 입력
  | "zero" // 세무상 인정되지 않는 자산·부채 (0원)
  | "deposit" // 예금: 장부가액 + 미수이자 − 원천징수세액
  | "depreciation" // 감가상각 세무상 재계산 (자산 명세)
  | "unconfirmed" // 확정되지 않은 부채 차감 (부채 명세)
  | "corporateTax" // 평가기준일까지의 법인세 등 납부할 세액 계산
  | "severance"; // 퇴직급여 추계액 (직원 명세)

export type DepreciationMethod = "declining" | "straight"; // 정률법 | 정액법

export interface FixedAssetRow {
  id: string;
  name: string;
  acquisitionDate: string; // YYYY-MM-DD
  cost: string; // 취득가액
  usefulLifeYears: string; // 기준내용연수
  method: DepreciationMethod;
  rate: string; // 상각률 (비우면 내용연수별 표준 상각률)
}

export interface UnconfirmedRow {
  id: string;
  name: string;
  amount: string;
}

export interface TaxCreditRow {
  id: string;
  name: string;
  amount: string; // 공제·감면 대상금액
  minimumTaxApplies: boolean; // 최저한세 적용대상 여부
  ruralTaxApplies: boolean; // 농어촌특별세 적용대상 여부
  excluded: string; // 공제·감면 배제액 (농어촌특별세 계산 시 차감)
}

export interface CorporateTaxInput {
  computedTax: string; // 산출세액 (법인세)
  localComputedTax: string; // 산출세액 (지방소득세분)
  credits: TaxCreditRow[];
  minimumTax: string; // 최저한세
  penaltyTax: string; // 가산세액
  interimPrepaid: string; // 중간예납세액
  withheld: string; // 원천납부세액
  additionalPayment: string; // 감면분 추가납부세액
  landTransferTax: string; // 토지 등 양도소득에 대한 법인세
  localPenaltyTax: string; // 가산세 (지방소득세분)
  localWithheld: string; // 원천납부세액 (지방소득세분)
  unappropriatedIncomeTax: string; // 미환류소득에 대한 법인세
}

export interface EmployeeRow {
  id: string;
  name: string;
  wage1: string; // 최근 3개월 급여 (1)
  wage2: string;
  wage3: string;
  annualBonus: string; // 연간 상여금
  hireDate: string; // 입사일 YYYY-MM-DD
}

export interface Account {
  id: string;
  side: Side;
  name: string;
  bookValue: string; // 재무상태표상 금액
  method: ValuationMethod;
  manualValue: string; // method = manual
  accruedInterest: string; // method = deposit: 평가기준일까지의 미수이자
  withholdingRatePercent: string; // method = deposit: 원천징수세율(%)
  fixedAssets: FixedAssetRow[]; // method = depreciation
  unconfirmed: UnconfirmedRow[]; // method = unconfirmed
  corporateTax: CorporateTaxInput; // method = corporateTax
  employees: EmployeeRow[]; // method = severance
}

export interface ReserveRow {
  id: string;
  name: string;
  reserveAmount: string; // 유보금액
  includeAmount: string; // 그중 순자산에 가감할 금액
}

export type NetIncomeTaxMode = "direct" | "computed";

// 1개 사업연도의 순손익액 계산 입력 (상증세법 시행령 제56조 제4항)
export interface NetIncomeYear {
  // 가산 항목
  taxableIncome: string; // 각 사업연도 소득금액
  refundInterest: string; // 국세·지방세 과오납 환급금 이자
  dividendExclusion: string; // 수입배당금 익금불산입액
  donationCarryover: string; // 기부금 한도초과 이월액 손금산입액
  vehicleCarryover: string; // 업무용승용차 관련비용 이월 손금추인액
  fxGain: string; // 화폐성 외화자산·부채 평가이익
  // 차감 항목
  fines: string; // 벌금·과태료·가산금·체납처분비
  publicCharges: string; // 공과금 중 손금불산입액
  nonBusiness: string; // 업무와 관련 없는 지출
  vehicleDisallowed: string; // 업무용승용차 관련비용 손금불산입액
  withholdingDefault: string; // 징수불이행 납부세액
  donationExcess: string; // 기부금 한도초과액·비지정기부금
  entertainmentExcess: string; // 접대비(기업업무추진비) 한도초과액
  interestDisallowed: string; // 지급이자 손금불산입액
  excessiveExpenses: string; // 과다경비 등 손금불산입액
  depreciationShortfall: string; // 감가상각 시인부족액 − 상각부인액 손금추인액
  fxLoss: string; // 화폐성 외화자산·부채 평가손실
  // 법인세 등 (총결정세액 + 농어촌특별세 + 지방소득세)
  taxMode: NetIncomeTaxMode;
  taxDirect: string; // 직접 입력
  computedTax: string; // 산출세액 (이월결손금 공제 효과 제거 후)
  creditsNonRural: string; // 공제·감면세액 중 농특세 비과세분
  creditsRural: string; // 공제·감면세액 중 농특세 과세분
  // 기타
  capitalChangeEffect: string; // 유상증자·감자 효과
  months: string; // 사업연도 월수 (연환산용)
  shares: string; // 사업연도말 주식수 (비우면 발행주식총수)
}

export interface BasicInfo {
  companyName: string;
  parValue: string; // 1주당 액면가액
  totalShares: string; // 발행주식총수
  businessStartDate: string; // 사업개시일
  valuationDate: string; // 평가기준일
  fiscalYearEndMonth: string; // 결산월 (1~12)
}

export interface Adjustments {
  reserves: ReserveRow[]; // 세무상 유보금액 명세
  liabilityTaxEtc: string; // 부채에 가산할 법인세 등 (재무제표 미반영분)
  purchasedGoodwill: string; // 매입한 무체재산권으로서 영업권 평가액
  capitalizationRatePercent: string; // 순손익가치 환원율(%)
}

export interface Judgment {
  // 순자산가치만으로 평가하는 사유 (시행령 제54조 제4항)
  stockRatioPercent: string; // 자산총액 중 주식 등 비율(%)
  liquidation: boolean; // 청산절차 진행 등 사업 계속 곤란
  dormant: boolean; // 사업개시 전, 휴업·폐업 중
  deficit3y: boolean; // 3년 내 사업연도부터 계속 결손
  limitedLife: boolean; // 잔여 존속기한 3년 이내
  // 부동산과다보유법인 판정
  reserveAdjust: string; // 유보금액 가감
  deductLand: string; // 차감조정: 토지 (장부)
  deductBuilding: string; // 차감조정: 건물 (장부)
  deductIntangible: string; // 차감조정: 무형자산
  deductFinancial: string; // 차감조정: 1년 내 차입·증자로 늘어난 금융자산·대여금
  realEstateLand: string; // 토지 [Max(기준시가, 장부가액)]
  realEstateBuilding: string; // 건물 [Max(기준시가, 장부가액)]
  realEstateStock: string; // 부동산과다보유법인 주식의 부동산 상당액
  // 최대주주 할증평가
  isMajorShareholder: boolean;
  isSmallBusiness: boolean; // 중소기업 (할증 제외)
  mergerCase: boolean; // 합병·증자·감자 등 증여이익 계산 대상
  earlyNoProfit: boolean; // 사업개시 3년 내 & 영업이익 0 이하
  liquidationConfirmed: boolean; // 청산 확정
  otherExempt: boolean; // 그 밖의 할증 제외 사유
}

export interface ValuationState {
  basic: BasicInfo;
  accounts: Account[];
  adjustments: Adjustments;
  netIncome: [NetIncomeYear, NetIncomeYear, NetIncomeYear]; // [1년 전, 2년 전, 3년 전]
  judgment: Judgment;
}
