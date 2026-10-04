// 엑셀에서 복사한 재무상태표(탭으로 구분된 텍스트)를 계정 목록으로 바꿉니다.
import { ACCOUNT_PRESETS, createAccount, createEmployee, createFixedAsset, type AccountPreset } from "./defaults.ts";
import { parseYmd } from "./num.ts";
import type { Account, DepreciationMethod, EmployeeRow, FixedAssetRow, Side, ValuationMethod } from "./types.ts";

export interface ImportedRow {
  side: Side;
  name: string;
  amount: number;
  method: ValuationMethod;
}

// 붙여넣은 표에서 금액이 들어 있는 열 하나 (분기·연도별 재무상태표가 여러 열일 수 있음)
export interface AmountColumn {
  index: number; // 붙여넣은 줄에서의 칸 위치
  label: string; // 머리글 (없으면 "n번째 금액 열")
  date: string | null; // 머리글에서 읽은 기준일 YYYY-MM-DD
}

export type ColumnReason =
  | "valuationDate"
  | "beforeValuationDate"
  | "afterValuationDate"
  | "latest"
  | "current"
  | "first"
  | "manual";

export interface SheetTotals {
  assetTotal: number | null;
  liabilityTotal: number | null;
  equityTotal: number | null;
  capital: number | null; // 자본금
}

export interface ImportResult {
  rows: ImportedRow[];
  skipped: number; // 제목·소계·자본 등으로 건너뛴 줄 수
  totals: SheetTotals; // 검증용 합계 줄
  columns: AmountColumn[]; // 금액 열이 2개 이상일 때만 채워짐
  column: number | null; // 실제로 읽은 열의 index
  reason: ColumnReason | null; // 그 열을 고른 이유
}

export interface ParseOptions {
  column?: number | null; // 사용자가 고른 열
  valuationDate?: string; // 평가기준일 YYYY-MM-DD (추천 열을 고를 때 사용)
  fiscalYearEndMonth?: number; // "2024년", "3분기"처럼 월이 없는 머리글을 날짜로 바꿀 때 사용
}

// 계정명 → 프리셋. 위에서부터 먼저 맞는 규칙을 씁니다.
const RULES: { side: Side; pattern: RegExp; preset: string }[] = [
  { side: "asset", pattern: /이연법인세자산/, preset: "이연법인세자산" },
  { side: "asset", pattern: /사용권자산/, preset: "사용권자산" },
  { side: "asset", pattern: /퇴직연금운용자산|퇴직보험예치금|국민연금전환금/, preset: "퇴직연금운용자산" },
  { side: "asset", pattern: /현금|예금|단기금융상품|장기금융상품|적금/, preset: "현금및현금성자산" },
  { side: "asset", pattern: /매출채권|외상매출|받을어음/, preset: "매출채권" },
  { side: "asset", pattern: /미수수익/, preset: "미수수익" },
  { side: "asset", pattern: /미수금/, preset: "미수금" },
  { side: "asset", pattern: /대여금/, preset: "대여금" },
  { side: "asset", pattern: /선급법인세|선납법인세|원천납부/, preset: "선급법인세" },
  { side: "asset", pattern: /선급비용/, preset: "선급비용" },
  { side: "asset", pattern: /선급금/, preset: "선급금" },
  { side: "asset", pattern: /계약자산/, preset: "계약자산" },
  { side: "asset", pattern: /재고|상품|제품|원재료|재공품|저장품/, preset: "재고자산" },
  { side: "asset", pattern: /보증금/, preset: "임차보증금" },
  { side: "asset", pattern: /비상장|출자금|지분|관계기업|종속기업/, preset: "비상장주식·출자금" },
  { side: "asset", pattern: /상장주식|단기매매증권|시장성/, preset: "상장주식" },
  { side: "asset", pattern: /주식|유가증권|금융자산/, preset: "비상장주식·출자금" },
  { side: "asset", pattern: /토지/, preset: "토지" },
  { side: "asset", pattern: /건물|구축물/, preset: "건물" },
  { side: "asset", pattern: /소프트웨어|개발비|무형|특허|상표|산업재산권/, preset: "무형자산(소프트웨어 등)" },
  { side: "asset", pattern: /비품|기계|차량|공구|기구|시설|장비|유형/, preset: "유형자산(비품 등)" },
  { side: "liability", pattern: /이연법인세부채/, preset: "이연법인세부채" },
  { side: "liability", pattern: /리스부채/, preset: "리스부채" },
  { side: "liability", pattern: /퇴직급여|퇴직금|확정급여/, preset: "퇴직급여충당부채" },
  { side: "liability", pattern: /법인세/, preset: "당기법인세부채" },
  { side: "liability", pattern: /매입채무|외상매입|지급어음/, preset: "매입채무" },
  { side: "liability", pattern: /미지급비용/, preset: "미지급비용" },
  { side: "liability", pattern: /장기미지급/, preset: "장기미지급금" },
  { side: "liability", pattern: /미지급/, preset: "미지급금" },
  { side: "liability", pattern: /부가세|부가가치세/, preset: "부가세예수금" },
  { side: "liability", pattern: /예수금/, preset: "예수금" },
  { side: "liability", pattern: /차입금|사채/, preset: "차입금" },
  { side: "liability", pattern: /선수|계약부채/, preset: "선수금·계약부채" },
  { side: "liability", pattern: /충당부채/, preset: "충당부채" },
];

// 바로 위 계정에서 빼는 차감 계정
const CONTRA = /누계액|대손충당금|현재가치할인차금/;
// 부채 아래에 차감 형식으로 표시되지만 상증세법상 별도 자산으로 보는 계정 (퇴직금 추계액을 부채로 잡으므로 따로 남겨 둠)
const PENSION_ASSET = /퇴직연금운용자산|퇴직보험예치금|국민연금전환금/;
// 금액이 있어도 계정이 아닌 줄 (구분 제목, 소계, 합계)
const NOT_ACCOUNT = /^(자산|부채|자본|유동자산|비유동자산|당좌자산|투자자산|기타비유동자산|유동부채|비유동부채)$|총계|합계|소계/;

function stripNumbering(text: string) {
  return text
    .replace(/^[\s　]*((\(|\[)?([0-9]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+|[IVX]+|[가-하])(\)|\]|\.)\s*)+/, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

export function parseAmount(cell: string): number | null {
  let text = cell.trim();
  if (text === "" || text === "-") return null;
  let negative = false;
  if (/^\(.*\)$/.test(text)) {
    negative = true;
    text = text.slice(1, -1);
  }
  if (/^[△▲-]/.test(text)) {
    negative = true;
    text = text.slice(1);
  }
  text = text.replace(/[,원\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  return negative ? -value : value;
}

export function matchPreset(name: string, side: Side): AccountPreset | undefined {
  const exact = ACCOUNT_PRESETS.find((preset) => preset.side === side && preset.name === name);
  if (exact) return exact;
  const rule = RULES.find((r) => r.side === side && r.pattern.test(name.replace(/\s/g, "")));
  return rule ? ACCOUNT_PRESETS.find((preset) => preset.side === side && preset.name === rule.preset) : undefined;
}

function sectionOf(name: string): Side | "equity" | null {
  if (/부채/.test(name) && !/총계/.test(name)) return "liability";
  if (/^자본/.test(name) && !/총계/.test(name)) return "equity";
  if (/자산$/.test(name) && NOT_ACCOUNT.test(name)) return "asset";
  if (name === "자산") return "asset";
  return null;
}

function lastDayOfMonth(year: number, month: number) {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// 열 머리글 → 기준일. "2024.09.30", "2024년 9월말", "FY2024 9월말", "2024.3Q", "2024년 3분기", "2024년" 등
export function parsePeriodLabel(label: string, fiscalYearEndMonth = 12): string | null {
  const text = label.replace(/[\s　]+/g, "");
  const full = parseDateCell(text) ?? parseDateCell(text.replace(/(\d{4})년(\d{1,2})월(\d{1,2})일?/, "$1-$2-$3"));
  if (full) return full;
  const year = /(\d{4})/.exec(text);
  if (!year) return null;
  const quarter = /([1-4])(?:Q|분기)/i.exec(text.slice(year.index + 4)) ?? /Q([1-4])/i.exec(text);
  if (quarter) return lastDayOfMonth(Number(year[1]), Number(quarter[1]) * 3);
  if (/반기/.test(text)) return lastDayOfMonth(Number(year[1]), 6);
  const yearMonth = /(\d{4})(?:[.\-/년]|(?=\d{1,2}월))(\d{1,2})(?!\d)/.exec(text) ?? /^(?:FY)?(\d{4})(\d{2})$/i.exec(text);
  if (yearMonth) {
    const month = Number(yearMonth[2]);
    if (month >= 1 && month <= 12) return lastDayOfMonth(Number(yearMonth[1]), month);
  }
  if (/^(FY)?\d{4}(년|년도)?(말|기말)?$/i.test(text)) return lastDayOfMonth(Number(year[1]), fiscalYearEndMonth);
  return null;
}

function splitLine(line: string) {
  return line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/);
}

function nameIndexOf(cells: string[]) {
  return cells.findIndex((cell) => /[가-힣A-Za-z]/.test(cell) && parseAmount(cell) === null);
}

// 금액이 들어 있는 열과 그 머리글을 찾습니다.
function findAmountColumns(lines: string[][], fiscalYearEndMonth?: number): AmountColumn[] {
  const counts = new Map<number, { n: number; max: number }>();
  let firstAmountLine = -1;
  lines.forEach((cells, lineIndex) => {
    const nameIndex = nameIndexOf(cells);
    if (nameIndex < 0) return;
    for (let i = nameIndex + 1; i < cells.length; i++) {
      const amount = parseAmount(cells[i]);
      if (amount === null) continue;
      if (firstAmountLine < 0) firstAmountLine = lineIndex;
      const entry = counts.get(i) ?? { n: 0, max: 0 };
      counts.set(i, { n: entry.n + 1, max: Math.max(entry.max, Math.abs(amount)) });
    }
  });
  const most = Math.max(0, ...[...counts.values()].map((c) => c.n));
  // 주석 번호처럼 작은 숫자만 있는 열, 금액이 드문 열은 제외
  const indexes = [...counts.entries()]
    .filter(([, c]) => c.max >= 1000 && c.n >= Math.max(1, Math.ceil(most * 0.2)))
    .map(([index]) => index)
    .sort((a, b) => a - b);

  // 첫 금액 줄 위의 머리글 줄에서 열 이름을 읽음. 병합된 머리글(기준일이 왼쪽 칸에만 있음)은 왼쪽의 기준일을 이어받음
  const headers = lines.slice(0, Math.max(0, firstAmountLine));
  return indexes.map((index, order) => {
    const parts: string[] = [];
    for (const cells of headers) {
      const own = (cells[index] ?? "").trim();
      if (own && parseAmount(own) === null) {
        parts.push(own);
        continue;
      }
      if (own) continue;
      for (let i = index - 1; i >= 0; i--) {
        const left = (cells[i] ?? "").trim();
        if (!left) continue;
        if (parsePeriodLabel(left, fiscalYearEndMonth)) parts.push(left);
        break;
      }
    }
    const label = parts.join(" ").replace(/[\s　]+/g, " ").trim();
    const date = parts.map((part) => parsePeriodLabel(part, fiscalYearEndMonth)).find((d) => d) ?? null;
    return { index, label: label || `${order + 1}번째 금액 열`, date };
  });
}

// 어느 열을 쓸지 추천: 평가기준일과 같은 시점 → 평가기준일 직전 → 평가기준일 직후 → (평가기준일 없으면) 가장 최근 → '당기' → 첫 번째 열
function recommendColumn(columns: AmountColumn[], valuationDate?: string): { index: number; reason: ColumnReason } {
  const dated = columns.filter((c) => c.date).sort((a, b) => (a.date! < b.date! ? 1 : -1));
  if (dated.length > 0) {
    if (valuationDate) {
      const same = dated.find((c) => c.date === valuationDate);
      if (same) return { index: same.index, reason: "valuationDate" };
      const before = dated.find((c) => c.date! < valuationDate);
      if (before) return { index: before.index, reason: "beforeValuationDate" };
      return { index: dated[dated.length - 1].index, reason: "afterValuationDate" };
    }
    return { index: dated[0].index, reason: "latest" };
  }
  const current = columns.find((c) => /당기|\(당\)/.test(c.label.replace(/\s/g, "")));
  if (current) return { index: current.index, reason: "current" };
  const terms = columns
    .map((c) => ({ c, n: Number(/제\s*(\d+)/.exec(c.label)?.[1] ?? NaN) }))
    .filter((t) => !Number.isNaN(t.n))
    .sort((a, b) => b.n - a.n);
  if (terms.length > 0) return { index: terms[0].c.index, reason: "current" };
  return { index: columns[0].index, reason: "first" };
}

export function parseBalanceSheet(text: string, defaultSide: Side, options: ParseOptions = {}): ImportResult {
  const rows: ImportedRow[] = [];
  let skipped = 0;
  let section: Side | "equity" = defaultSide;

  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "").map(splitLine);
  const found = findAmountColumns(lines, options.fiscalYearEndMonth);
  const columns = found.length >= 2 ? found : [];
  let column: number | null = null;
  let reason: ColumnReason | null = null;
  if (columns.length > 0) {
    const chosen = columns.find((c) => c.index === options.column);
    if (chosen) {
      column = chosen.index;
      reason = "manual";
    } else {
      ({ index: column, reason } = recommendColumn(columns, options.valuationDate));
    }
  }

  const totals: SheetTotals = { assetTotal: null, liabilityTotal: null, equityTotal: null, capital: null };
  for (const cells of lines) {
    const nameIndex = nameIndexOf(cells);
    if (nameIndex < 0) {
      skipped++;
      continue;
    }
    const name = stripNumbering(cells[nameIndex]);
    let amount: number | null = null;
    if (column !== null) amount = column > nameIndex ? parseAmount(cells[column] ?? "") : null;
    else for (let i = nameIndex + 1; i < cells.length && amount === null; i++) amount = parseAmount(cells[i]);

    if (amount !== null) {
      if (/부채(와|및)?자본총계/.test(name)) {
        // 부채와자본총계는 검증에 쓰지 않음
      } else if (/자산총계/.test(name)) totals.assetTotal = amount;
      else if (/부채총계/.test(name)) totals.liabilityTotal = amount;
      else if (/자본총계/.test(name)) totals.equityTotal = amount;
      else if (name === "자본금" && totals.capital === null) totals.capital = amount;
    }

    const nextSection = sectionOf(name);
    if (nextSection) section = nextSection;

    if (amount === null || amount === 0 || NOT_ACCOUNT.test(name) || section === "equity") {
      skipped++;
      continue;
    }

    if (CONTRA.test(name)) {
      const previous = [...rows].reverse().find((row) => row.side === section);
      if (previous) {
        previous.amount -= Math.abs(amount);
        continue;
      }
    }

    // 퇴직연금운용자산 등은 부채 아래 차감 형식으로 있어도 별도 자산으로 둠
    const side: Side = PENSION_ASSET.test(name) ? "asset" : section;
    const preset = matchPreset(name, side);
    rows.push({ side, name, amount: side !== section ? Math.abs(amount) : amount, method: preset?.method ?? "book" });
  }

  return { rows, skipped, totals, columns, column, reason };
}

export function rowsToAccounts(rows: ImportedRow[]): Account[] {
  return rows.map((row) => {
    const account = createAccount(row.side, row.name, row.method);
    const book = String(row.amount);
    return { ...account, bookValue: book };
  });
}

// ───── 명세 붙여넣기 (감가상각 자산, 직원) ─────

export interface RowImport<T> {
  rows: T[];
  skipped: number;
}

function splitCells(line: string) {
  return (line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/)).map((cell) => cell.trim());
}

// 2018-08-30, 2018.8.30, 2018. 8. 30., 2018/08/30, 20180830 → YYYY-MM-DD
export function parseDateCell(cell: string): string | null {
  const text = cell.trim().replace(/\.$/, "");
  const match = /^(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})$/.exec(text) ?? /^(\d{4})(\d{2})(\d{2})$/.exec(text);
  if (!match) return null;
  const ymd = `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  return parseYmd(ymd) ? ymd : null;
}

function isTotalLine(cells: string[]) {
  return cells.some((cell) => /합계|소계|총계|^계$/.test(cell.replace(/\s/g, "")));
}

export function parseFixedAssets(text: string): RowImport<FixedAssetRow> {
  const rows: FixedAssetRow[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const cells = splitCells(line);
    const dateIndex = cells.findIndex((cell) => parseDateCell(cell) !== null);
    if (dateIndex < 0 || isTotalLine(cells)) {
      skipped++;
      continue;
    }
    const method: DepreciationMethod = cells.some((c) => /정액/.test(c)) ? "straight" : "declining";
    const name = cells.find((c, i) => i !== dateIndex && /[가-힣A-Za-z]/.test(c) && parseAmount(c) === null && !/정액|정률/.test(c)) ?? "";
    const numbers = cells.map((c, i) => (i === dateIndex ? null : parseAmount(c))).filter((n): n is number => n !== null);
    const cost = Math.max(0, ...numbers.filter((n) => n > 60));
    const life = numbers.find((n) => Number.isInteger(n) && n >= 1 && n <= 60);
    const rate = numbers.find((n) => n > 0 && n < 1);
    if (cost <= 0) {
      skipped++;
      continue;
    }
    rows.push({
      ...createFixedAsset(),
      name,
      acquisitionDate: parseDateCell(cells[dateIndex])!,
      cost: String(cost),
      usefulLifeYears: life ? String(life) : "5",
      method,
      rate: rate ? String(rate) : "",
    });
  }
  return { rows, skipped };
}

export function parseEmployees(text: string): RowImport<EmployeeRow> {
  const rows: EmployeeRow[] = [];
  let skipped = 0;
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const cells = splitCells(line);
    const dateIndex = cells.findIndex((cell) => parseDateCell(cell) !== null);
    if (dateIndex < 0 || isTotalLine(cells)) {
      skipped++;
      continue;
    }
    const name = cells.find((c, i) => i !== dateIndex && /[가-힣A-Za-z]/.test(c) && parseAmount(c) === null) ?? "";
    const amounts = cells
      .map((c, i) => (i === dateIndex ? null : parseAmount(c)))
      .filter((n): n is number => n !== null && n >= 1000);
    if (amounts.length === 0) {
      skipped++;
      continue;
    }
    let wages: number[];
    let bonus = 0;
    if (amounts.length === 1) wages = [amounts[0], amounts[0], amounts[0]];
    else if (amounts.length === 2) {
      wages = [amounts[0], amounts[0], amounts[0]];
      bonus = amounts[1];
    } else {
      wages = amounts.slice(0, 3);
      bonus = amounts[3] ?? 0;
    }
    rows.push({
      ...createEmployee(),
      name,
      hireDate: parseDateCell(cells[dateIndex])!,
      wage1: String(wages[0]),
      wage2: String(wages[1]),
      wage3: String(wages[2]),
      annualBonus: bonus ? String(bonus) : "",
    });
  }
  return { rows, skipped };
}
