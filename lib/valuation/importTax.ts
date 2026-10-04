// 법인세 신고서 서식 붙여넣기: 세액조정계산서, 소득금액조정합계표, 자본금과 적립금 조정명세서(을)
// 엑셀에서 복사한 표(탭 구분)와 PDF에서 복사한 텍스트(공백 구분)를 모두 읽습니다.
import { createReserve } from "./defaults.ts";
import { parseAmount } from "./importSheet.ts";
import { daysBetween, num, parseYmd } from "./num.ts";
import type { Account, NetIncomeYear, ReserveRow } from "./types.ts";

// ───── 공통: 줄을 "과목 + 금액 (+ 소득처분)" 항목으로 나누기 ─────

interface Token {
  text: string;
  cell: number; // 탭으로 나뉜 칸 번호 (공백 구분이면 0)
}

interface Entry {
  label: string; // 정리된 과목명
  raw: string; // 원래 과목명
  amount: number;
  amounts: number[]; // 같은 과목 뒤에 이어진 금액들
  disposition: string; // 소득처분 (유보, 기타사외유출 등)
  cell: number; // 과목이 시작된 칸
}

const DISPOSITION = /^(유보|유보발생|유보감소|△?유보|기타사외유출|사외유출|상여|배당|기타소득|기타)$/;

function tokenize(line: string): Token[] {
  const cells = line.includes("\t") ? line.split("\t") : [line];
  const tokens: Token[] = [];
  cells.forEach((cell, index) => {
    for (const text of cell.trim().split(/[\s　]+/)) if (text) tokens.push({ text, cell: index });
  });
  return tokens;
}

// 서식의 줄 번호(01, 102 등)처럼 쉼표 없는 짧은 숫자는 금액으로 보지 않음
function amountOf(text: string): number | null {
  const amount = parseAmount(text);
  if (amount === null) return null;
  const digits = text.replace(/[^\d]/g, "");
  if (!/[,△▲()-]/.test(text) && digits.length <= 3) return null;
  return amount;
}

export function normalizeLabel(text: string): string {
  return text
    .replace(/\([^)]*[=+\d][^)]*\)/g, "") // (⑩=⑧+⑨) 같은 계산식
    .replace(/[①-⓿❶-➓㉑-㉟㊱-㊿]/g, "") // 원문자 번호
    .replace(/[0-9]/g, "")
    .replace(/[\s　.·ㆍ,:()[\]「」『』<>-]/g, "");
}

function entriesOf(line: string): Entry[] {
  const entries: Entry[] = [];
  let labelTokens: Token[] = [];
  let current: Entry | null = null;
  for (const token of tokenize(line)) {
    const amount = amountOf(token.text);
    if (amount !== null) {
      if (labelTokens.length > 0) {
        const raw = labelTokens.map((t) => t.text).join(" ");
        current = { label: normalizeLabel(raw), raw, amount, amounts: [amount], disposition: "", cell: labelTokens[0].cell };
        entries.push(current);
        labelTokens = [];
      } else if (current) current.amounts.push(amount);
      continue;
    }
    if (current && !current.disposition && labelTokens.length === 0 && DISPOSITION.test(token.text)) {
      current.disposition = token.text;
      continue;
    }
    if (/^\d{1,3}$/.test(token.text) && labelTokens.length === 0) continue; // 줄 번호
    labelTokens.push(token);
  }
  return entries.filter((entry) => /[가-힣A-Za-z]/.test(entry.label));
}

const TOTAL = /^(합계|계|소계|총계)$/;

// ───── 사업연도 ─────

export interface FiscalPeriod {
  start: string;
  end: string;
  months: number;
}

export function detectPeriod(text: string): FiscalPeriod | null {
  const d = String.raw`(\d{4})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})\s*일?\s*\.?`;
  const match = new RegExp(`${d}\\s*[~∼～\\-]\\s*${d}`).exec(text);
  if (!match) return null;
  const ymd = (y: string, m: string, day: string) => `${y}-${m.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const start = ymd(match[1], match[2], match[3]);
  const end = ymd(match[4], match[5], match[6]);
  const s = parseYmd(start);
  const e = parseYmd(end);
  if (!s || !e) return null;
  const months = Math.min(12, Math.max(1, Math.round((daysBetween(s, e) + 1) / 30.4375)));
  return { start, end, months };
}

// 평가기준일 직전 3개 사업연도 중 몇 번째인지 (0 = 1년 전). 평가기준일이 속한 사업연도는 제외
export function yearIndexOf(periodEnd: string, valuationDate: string, fiscalYearEndMonth: number): number | null {
  const end = parseYmd(periodEnd);
  const valuation = parseYmd(valuationDate);
  if (!end || !valuation) return null;
  let latestYear = valuation.y;
  const fyEnd = new Date(Date.UTC(latestYear, fiscalYearEndMonth, 0));
  if (fyEnd.getTime() >= Date.UTC(valuation.y, valuation.m - 1, valuation.d)) latestYear -= 1;
  // 사업연도 종료월이 결산월과 같으면 그 해로, 아니면(신설 등) 종료일 기준으로 가장 가까운 사업연도에 배정
  const endYear = end.m <= fiscalYearEndMonth ? end.y : end.y + 1;
  const index = latestYear - endYear;
  return index >= 0 && index <= 2 ? index : null;
}

// ───── 법인세율 (이월결손금 공제 전 산출세액을 다시 계산할 때 사용) ─────

function bracketsFor(year: number): [number, number][] {
  if (year >= 2023) return [[200_000_000, 0.09], [20_000_000_000, 0.19], [300_000_000_000, 0.21], [Infinity, 0.24]];
  if (year >= 2018) return [[200_000_000, 0.1], [20_000_000_000, 0.2], [300_000_000_000, 0.22], [Infinity, 0.25]];
  return [[200_000_000, 0.1], [20_000_000_000, 0.2], [Infinity, 0.22]];
}

export function corporateTaxByBrackets(taxBase: number, year: number, months = 12): number {
  if (taxBase <= 0) return 0;
  const annual = (taxBase * 12) / months;
  let tax = 0;
  let lower = 0;
  for (const [upper, rate] of bracketsFor(year)) {
    if (annual > lower) tax += (Math.min(annual, upper) - lower) * rate;
    lower = upper;
  }
  return Math.floor((tax * months) / 12);
}

// ───── 법인세 과세표준 및 세액조정계산서 ─────

export interface TaxReturnResult {
  period: FiscalPeriod | null;
  taxableIncome: number | null; // 각 사업연도 소득금액
  taxBase: number | null; // 과세표준
  lossCarryforward: number | null; // 이월결손금
  computedTax: number | null; // 산출세액 (신고서 그대로)
  recomputedTax: number | null; // 이월결손금 공제 전으로 다시 계산한 산출세액
  credits: number; // 공제·감면세액 합계
  ruralTax: number | null; // 농어촌특별세
  found: { label: string; amount: number }[]; // 읽은 항목 (미리보기용)
}

export function parseTaxReturn(text: string): TaxReturnResult {
  const entries = text.split(/\r?\n/).flatMap(entriesOf);
  const found: { label: string; amount: number }[] = [];
  const first = (pattern: RegExp, label: string) => {
    const entry = entries.find((e) => pattern.test(e.label));
    if (entry) found.push({ label, amount: entry.amount });
    return entry ? entry.amount : null;
  };

  const period = detectPeriod(text);
  const taxableIncome = first(/^각사업연도소득금액/, "각 사업연도 소득금액");
  const lossCarryforward = first(/^이월결손금/, "이월결손금");
  const taxBase = first(/^과세표준$|^과세표준금액/, "과세표준");
  const computedTax = first(/^산출세액$/, "산출세액");
  const creditsSubject = first(/최저한세적용대상공제감면세액/, "최저한세 적용대상 공제감면세액") ?? 0;
  const creditsExempt = first(/최저한세적용제외공제감면세액/, "최저한세 적용제외 공제감면세액") ?? 0;
  const ruralTax = first(/^농어촌특별세/, "농어촌특별세");

  let recomputedTax: number | null = null;
  if (lossCarryforward && lossCarryforward > 0 && taxBase !== null && period) {
    const year = Number(period.end.slice(0, 4));
    recomputedTax = corporateTaxByBrackets(taxBase + lossCarryforward, year, period.months);
  }

  return {
    period,
    taxableIncome,
    taxBase,
    lossCarryforward,
    computedTax,
    recomputedTax,
    credits: creditsSubject + creditsExempt,
    ruralTax,
    found,
  };
}

// 세액조정계산서 → 순손익액 입력값
export function taxReturnPatch(result: TaxReturnResult): Partial<NetIncomeYear> {
  const patch: Partial<NetIncomeYear> = { taxMode: "computed" };
  if (result.taxableIncome !== null) patch.taxableIncome = String(result.taxableIncome);
  const tax = result.recomputedTax ?? result.computedTax;
  if (tax !== null) patch.computedTax = String(tax);
  // 농어촌특별세 = 농특세 과세 대상 감면세액 × 20% → 감면세액을 과세/비과세로 나눔
  const rural = result.ruralTax ? Math.min(result.ruralTax * 5, result.credits) : 0;
  patch.creditsRural = rural ? String(rural) : "";
  patch.creditsNonRural = result.credits - rural ? String(result.credits - rural) : "";
  if (result.period) {
    patch.period = `${result.period.start} ~ ${result.period.end}`;
    patch.months = String(result.period.months);
  }
  patch.lossCarryforward = result.lossCarryforward ? String(result.lossCarryforward) : "";
  return patch;
}

// ───── 소득금액조정합계표 ─────

type AdjustmentKey =
  | "refundInterest"
  | "dividendExclusion"
  | "donationCarryover"
  | "vehicleCarryover"
  | "fxGain"
  | "fines"
  | "publicCharges"
  | "nonBusiness"
  | "vehicleDisallowed"
  | "withholdingDefault"
  | "donationExcess"
  | "entertainmentExcess"
  | "interestDisallowed"
  | "excessiveExpenses"
  | "depreciationShortfall"
  | "fxLoss";

export const ADJUSTMENT_KEYS: AdjustmentKey[] = [
  "refundInterest",
  "dividendExclusion",
  "donationCarryover",
  "vehicleCarryover",
  "fxGain",
  "fines",
  "publicCharges",
  "nonBusiness",
  "vehicleDisallowed",
  "withholdingDefault",
  "donationExcess",
  "entertainmentExcess",
  "interestDisallowed",
  "excessiveExpenses",
  "depreciationShortfall",
  "fxLoss",
];

export interface AdjustmentItem {
  side: "plus" | "minus"; // plus = 익금산입·손금불산입, minus = 손금산입·익금불산입
  name: string;
  amount: number;
  disposition: string;
  field: AdjustmentKey | null; // 순손익액에 반영할 칸 (null = 각 사업연도 소득에 이미 포함되어 따로 반영하지 않음)
}

// 손금산입·익금불산입 쪽에 주로 나오는 과목 (한쪽만 있는 줄의 위치를 짐작할 때 사용)
const MINUS_HINT = /손금산입|익금불산입|손금추인|환급금이자|환급가산금|수입배당금|미수수익|전기|이월|퇴직연금|퇴직보험/;

function fieldOf(side: "plus" | "minus", label: string): AdjustmentKey | null {
  if (side === "plus") {
    if (/지급이자|건설자금이자|채권자불분명|비실명/.test(label)) return "interestDisallowed";
    if (/벌금|과태료|과료|가산금|체납처분|강제징수/.test(label)) return "fines";
    if (/공과금/.test(label)) return "publicCharges";
    if (/업무용승용차/.test(label)) return "vehicleDisallowed";
    if (/업무무관|업무와관련없/.test(label)) return "nonBusiness";
    if (/징수불이행/.test(label)) return "withholdingDefault";
    if (/기부금/.test(label)) return "donationExcess";
    if (/접대비|기업업무추진비/.test(label)) return "entertainmentExcess";
    if (/과다경비|과다인건비|임원상여|임원퇴직|임원보수|복리후생비/.test(label)) return "excessiveExpenses";
    if (/외화환산손실|외화평가손실|외화자산평가손실/.test(label)) return "fxLoss";
    return null;
  }
  if (/환급금이자|환급가산금/.test(label)) return "refundInterest";
  if (/수입배당금/.test(label)) return "dividendExclusion";
  if (/기부금/.test(label)) return "donationCarryover";
  if (/업무용승용차/.test(label)) return "vehicleCarryover";
  if (/외화환산이익|외화평가이익|외화자산평가이익/.test(label)) return "fxGain";
  if (/감가상각/.test(label)) return "depreciationShortfall";
  return null;
}

export interface IncomeAdjustmentResult {
  items: AdjustmentItem[];
  patch: Partial<NetIncomeYear>;
  period: FiscalPeriod | null;
}

export function parseIncomeAdjustments(text: string): IncomeAdjustmentResult {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  // 머리글에서 손금산입 쪽이 시작되는 칸을 찾음 (탭으로 구분된 표일 때)
  let rightStart: number | null = null;
  for (const line of lines) {
    if (!line.includes("\t")) continue;
    const cells = line.split("\t").map((c) => c.replace(/\s/g, ""));
    const plus = cells.findIndex((c) => /익금산입|손금불산입/.test(c));
    const minus = cells.findIndex((c, i) => i > plus && /손금산입|익금불산입/.test(c) && !/손금불산입/.test(c));
    if (plus >= 0 && minus > plus) {
      rightStart = minus;
      break;
    }
  }

  const items: AdjustmentItem[] = [];
  for (const line of lines) {
    const entries = entriesOf(line).filter((e) => !TOTAL.test(e.label) && e.amount !== 0);
    entries.forEach((entry, order) => {
      let side: "plus" | "minus";
      if (rightStart !== null && line.includes("\t")) side = entry.cell >= rightStart ? "minus" : "plus";
      else if (entries.length >= 2) side = order === 0 ? "plus" : "minus";
      else side = MINUS_HINT.test(entry.label) ? "minus" : "plus";
      items.push({ side, name: entry.raw, amount: entry.amount, disposition: entry.disposition, field: fieldOf(side, entry.label) });
    });
  }

  const sums = new Map<AdjustmentKey, number>();
  for (const item of items) {
    if (!item.field) continue;
    // 감가상각비 손금추인액은 시인부족액에서 빼는 금액
    const signed = item.field === "depreciationShortfall" ? -item.amount : item.amount;
    sums.set(item.field, (sums.get(item.field) ?? 0) + signed);
  }
  const patch: Partial<NetIncomeYear> = { adjustmentsPasted: true };
  for (const key of ADJUSTMENT_KEYS) patch[key] = sums.has(key) ? String(sums.get(key)) : "";
  return { items, patch, period: detectPeriod(text) };
}

// ───── 자본금과 적립금 조정명세서(을) ─────

export interface ReserveDecision {
  include: boolean;
  note: string;
}

// 유보 과목이 앞 단계에서 이미 다시 평가한 계정과 겹치는지 판단
export function reserveDecision(name: string, accounts: Account[]): ReserveDecision {
  const label = name.replace(/\s/g, "");
  const has = (pick: (a: Account) => boolean) => accounts.some(pick);
  if (/사용권자산|리스/.test(label)) return { include: false, note: "리스 관련 자산·부채를 0원으로 평가해서 제외" };
  if (/이연법인세/.test(label)) return { include: false, note: "이연법인세는 0원으로 평가해서 제외" };
  if (/외화환산|외화평가/.test(label)) return { include: false, note: "외화자산·부채는 평가기준일 환율로 평가한 장부가액을 써서 제외" };
  if (/미수수익|미수이자/.test(label)) return { include: false, note: "상증세법상 미수이자도 자산이므로 빼지 않음" };
  if (/퇴직급여|퇴직연금|퇴직보험|퇴직금/.test(label)) return { include: false, note: "퇴직급여는 추계액으로, 퇴직연금운용자산은 장부가액으로 평가해서 제외" };
  if (/감가상각|상각부인|상각비/.test(label)) {
    return has((a) => a.method === "depreciation" && a.fixedAssets.length > 0)
      ? { include: false, note: "감가상각자산을 세법 기준으로 다시 계산해서 제외" }
      : { include: true, note: "감가상각 명세가 없어 장부가액으로 평가했으므로 포함" };
  }
  if (/토지|건물|구축물|취득세|재평가/.test(label)) {
    return has((a) => a.method === "realEstate" && (a.marketValue.trim() !== "" || a.standardValue.trim() !== ""))
      ? { include: false, note: "토지·건물을 시가·기준시가로 다시 평가해서 제외" }
      : { include: true, note: "토지·건물 시가·기준시가가 아직 없어 포함" };
  }
  if (/재고/.test(label)) {
    return has((a) => a.method === "inventory" && a.disposalValue.trim() !== "")
      ? { include: false, note: "재고자산을 처분가액으로 평가해서 제외" }
      : { include: true, note: "세무상 금액 반영" };
  }
  if (/선급비용/.test(label)) {
    return has((a) => a.method === "prepaidExpense" && a.expensedAmount.trim() !== "")
      ? { include: false, note: "선급비용을 따로 평가해서 제외" }
      : { include: true, note: "세무상 금액 반영" };
  }
  if (/충당부채|충당금|미지급비용|연차|미지급/.test(label) && !/대손충당금/.test(label)) {
    return has((a) => a.method === "provision" && a.confirmedAmount.trim() !== "")
      ? { include: false, note: "충당부채·미지급비용을 확정액으로 평가해서 제외" }
      : { include: true, note: "확정되지 않은 부채를 빼는 효과로 포함" };
  }
  return { include: true, note: "세무상 금액 반영" };
}

export interface ReserveImport {
  rows: ReserveRow[];
  skipped: number;
}

export function parseReserves(text: string, accounts: Account[]): ReserveImport {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
  // 탭으로 구분된 표면 '기말' 머리글 칸을 찾음
  let endColumn: number | null = null;
  for (const line of lines) {
    if (!line.includes("\t")) continue;
    const index = line.split("\t").findIndex((c) => /기말/.test(c.replace(/\s/g, "")));
    if (index >= 0) {
      endColumn = index;
      break;
    }
  }

  const rows: ReserveRow[] = [];
  let skipped = 0;
  for (const line of lines) {
    const entry = entriesOf(line)[0];
    if (!entry || TOTAL.test(entry.label) || /과목|사항|기초|기말|잔액/.test(entry.label)) {
      skipped++;
      continue;
    }
    let amount: number | null = null;
    if (endColumn !== null && line.includes("\t")) amount = parseAmount(line.split("\t")[endColumn] ?? "");
    else amount = entry.amounts.length >= 4 ? entry.amounts[3] : entry.amounts[entry.amounts.length - 1];
    if (!amount) {
      skipped++;
      continue;
    }
    const decision = reserveDecision(entry.raw, accounts);
    rows.push({
      ...createReserve(),
      name: entry.raw,
      reserveAmount: String(amount),
      includeAmount: decision.include ? String(amount) : "0",
      note: decision.note,
    });
  }
  return { rows, skipped };
}

// 부동산 비율 판정의 '유보금액 가감'에 쓰는 자산 관련 유보 합계 (부채 관련 유보는 총자산을 바꾸지 않음)
export function assetReserveTotal(rows: ReserveRow[]): number {
  return rows
    .filter((row) => !/충당부채|미지급|퇴직급여충당|연차|리스부채|선수|예수/.test(row.name.replace(/\s/g, "")))
    .reduce((sum, row) => sum + num(row.reserveAmount), 0);
}
