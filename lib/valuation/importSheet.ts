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

export interface ImportResult {
  rows: ImportedRow[];
  skipped: number; // 제목·소계·자본 등으로 건너뛴 줄 수
}

// 계정명 → 프리셋. 위에서부터 먼저 맞는 규칙을 씁니다.
const RULES: { side: Side; pattern: RegExp; preset: string }[] = [
  { side: "asset", pattern: /이연법인세자산/, preset: "이연법인세자산" },
  { side: "asset", pattern: /사용권자산/, preset: "사용권자산" },
  { side: "asset", pattern: /현금|예금|단기금융상품|장기금융상품|적금/, preset: "현금및현금성자산" },
  { side: "asset", pattern: /매출채권|외상매출|받을어음/, preset: "매출채권" },
  { side: "asset", pattern: /미수수익/, preset: "미수수익" },
  { side: "asset", pattern: /미수금/, preset: "미수금" },
  { side: "asset", pattern: /선급법인세|선납법인세|원천납부/, preset: "선급법인세" },
  { side: "asset", pattern: /선급비용/, preset: "선급비용" },
  { side: "asset", pattern: /선급금/, preset: "선급금" },
  { side: "asset", pattern: /계약자산/, preset: "계약자산" },
  { side: "asset", pattern: /재고|상품|제품|원재료|재공품|저장품/, preset: "재고자산" },
  { side: "asset", pattern: /보증금/, preset: "임차보증금" },
  { side: "asset", pattern: /주식|유가증권|금융자산|출자금|지분/, preset: "금융자산(주식 등)" },
  { side: "asset", pattern: /토지/, preset: "토지" },
  { side: "asset", pattern: /건물|구축물/, preset: "건물" },
  { side: "asset", pattern: /소프트웨어|개발비|무형|특허|상표|산업재산권/, preset: "무형자산(소프트웨어 등)" },
  { side: "asset", pattern: /비품|기계|차량|공구|기구|시설|장비|유형/, preset: "유형자산(비품 등)" },
  { side: "liability", pattern: /이연법인세부채/, preset: "이연법인세부채" },
  { side: "liability", pattern: /리스부채/, preset: "리스부채" },
  { side: "liability", pattern: /퇴직급여|퇴직금|확정급여/, preset: "퇴직급여충당부채" },
  { side: "liability", pattern: /법인세/, preset: "당기법인세부채" },
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
const CONTRA = /누계액|대손충당금|현재가치할인차금|퇴직연금운용자산|국민연금전환금/;
// 금액이 있어도 계정이 아닌 줄 (구분 제목, 소계, 합계)
const NOT_ACCOUNT = /^(자산|부채|자본|유동자산|비유동자산|당좌자산|투자자산|기타비유동자산|유동부채|비유동부채)$|총계|합계|소계/;

function stripNumbering(text: string) {
  return text
    .replace(/^[\s　]*((\(|\[)?([0-9]+|[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]+|[IVX]+|[가-하])(\)|\]|\.)\s*)+/, "")
    .replace(/[\s　]+/g, "")
    .trim();
}

function parseAmount(cell: string): number | null {
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

export function parseBalanceSheet(text: string, defaultSide: Side): ImportResult {
  const rows: ImportedRow[] = [];
  let skipped = 0;
  let section: Side | "equity" = defaultSide;

  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const cells = line.includes("\t") ? line.split("\t") : line.split(/\s{2,}/);

    const nameIndex = cells.findIndex((cell) => /[가-힣A-Za-z]/.test(cell) && parseAmount(cell) === null);
    if (nameIndex < 0) {
      skipped++;
      continue;
    }
    const name = stripNumbering(cells[nameIndex]);
    let amount: number | null = null;
    for (let i = nameIndex + 1; i < cells.length && amount === null; i++) amount = parseAmount(cells[i]);

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

    const side: Side = section;
    const preset = matchPreset(name, side);
    rows.push({ side, name, amount, method: preset?.method ?? "book" });
  }

  return { rows, skipped };
}

export function rowsToAccounts(rows: ImportedRow[]): Account[] {
  return rows.map((row) => {
    const account = createAccount(row.side, row.name, row.method);
    const book = String(row.amount);
    // 직접 입력 방식은 평가액을 장부가액으로 미리 채워 둠 (사용자가 고칠 때까지 평가차액 0)
    return { ...account, bookValue: book, manualValue: row.method === "manual" ? book : "" };
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
