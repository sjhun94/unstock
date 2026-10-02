// 숫자·날짜 변환 도우미

export function num(value: string | undefined | null): number {
  const n = Number(String(value ?? "").replaceAll(",", "").trim());
  return Number.isFinite(n) ? n : 0;
}

export interface Ymd {
  y: number;
  m: number; // 1~12
  d: number;
}

export function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return { y, m, d };
}

// 월 단위 일련번호 (연×12 + 월)
export function monthIndex(date: Ymd): number {
  return date.y * 12 + (date.m - 1);
}

export function daysBetween(start: Ymd, end: Ymd): number {
  const a = Date.UTC(start.y, start.m - 1, start.d);
  const b = Date.UTC(end.y, end.m - 1, end.d);
  return Math.round((b - a) / 86_400_000);
}

// start로부터 years년이 되는 날이 end 이후인지 (= 아직 years년이 지나지 않았는지)
export function isWithinYears(start: Ymd, end: Ymd, years: number): boolean {
  const anniversary = Date.UTC(start.y + years, start.m - 1, start.d);
  return Date.UTC(end.y, end.m - 1, end.d) < anniversary;
}

// 엑셀 ROUND와 같은 방식(0에서 먼 쪽으로 반올림)
export function roundHalfAway(value: number, digits = 0): number {
  const factor = 10 ** digits;
  const scaled = Math.abs(value) * factor;
  return (Math.sign(value) * Math.round(scaled + 1e-9)) / factor;
}
