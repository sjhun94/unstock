// 개별공시지가 자동 조회 도우미 (브이월드 API 응답 해석, 평가기준일에 맞는 연도 고르기)
// 서버(app/api/land-price)와 화면에서 함께 씁니다.

export interface LandCandidate {
  pnu: string; // 필지 고유번호 (19자리)
  address: string; // 지번 주소
}

export interface LandPriceRecord {
  year: number; // 기준연도
  pricePerSqm: number; // ㎡당 개별공시지가
  announcedDate: string | null; // 공시일자 YYYY-MM-DD
}

export interface LandPriceResult {
  pnu: string;
  address: string;
  year: number; // 적용한 기준연도
  pricePerSqm: number;
  announcedDate: string; // 적용한 가격의 공시일자 (모르면 그 해 5월 31일로 봄)
  area: number | null; // 토지대장 면적 ㎡
  landCategory: string | null; // 지목
  note: string;
}

export type LandPriceResponse =
  | { kind: "result"; result: LandPriceResult }
  | { kind: "candidates"; candidates: LandCandidate[] }
  | { kind: "error"; code: "not_configured" | "not_found" | "rate_limited" | "bad_request" | "upstream"; message: string };

// 응답 JSON 안에서 특정 키를 가진 객체를 모두 찾음 (API마다 감싸는 구조가 달라서 깊이와 상관없이 찾음)
export function findRecords(value: unknown, key: string): Record<string, unknown>[] {
  const found: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      const record = node as Record<string, unknown>;
      if (key in record) found.push(record);
      Object.values(record).forEach(walk);
    }
  };
  walk(value);
  return found;
}

function toNumber(value: unknown): number | null {
  const n = Number(String(value ?? "").replace(/,/g, "").trim());
  return String(value ?? "").trim() !== "" && Number.isFinite(n) ? n : null;
}

// 20240531, 2024-05-31, 2024.05.31 → 2024-05-31
export function toYmd(value: unknown): string | null {
  const text = String(value ?? "").trim();
  const match = /^(\d{4})[-.]?(\d{2})[-.]?(\d{2})/.exec(text);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

// 주소 검색 응답 → 후보 필지
export function parseSearch(json: unknown): LandCandidate[] {
  return findRecords(json, "id")
    .map((item) => {
      const address = item.address as Record<string, unknown> | undefined;
      const parcel = String(address?.parcel ?? item.title ?? "").trim();
      return { pnu: String(item.id ?? ""), address: parcel };
    })
    .filter((c) => /^\d{19}$/.test(c.pnu));
}

// 개별공시지가 응답 → 연도별 가격
export function parsePrices(json: unknown): LandPriceRecord[] {
  return findRecords(json, "pblntfPclnd")
    .map((r) => ({
      year: toNumber(r.stdrYear) ?? 0,
      pricePerSqm: toNumber(r.pblntfPclnd) ?? 0,
      announcedDate: toYmd(r.pblntfDe),
    }))
    .filter((r) => r.year > 0 && r.pricePerSqm > 0);
}

// 토지임야 응답 → 면적·지목
export function parseLand(json: unknown): { area: number | null; landCategory: string | null } {
  const record = findRecords(json, "lndpclAr")[0];
  if (!record) return { area: null, landCategory: null };
  return { area: toNumber(record.lndpclAr), landCategory: record.lndcgrCodeNm ? String(record.lndcgrCodeNm) : null };
}

// 평가기준일 현재 고시되어 있는 가장 최근 공시지가 (상증세법 제61조 제1항 제1호)
// 공시일자를 모르면 그 해 5월 31일에 고시된 것으로 봄
export function pickPrice(records: LandPriceRecord[], valuationDate: string): (LandPriceRecord & { announcedDate: string }) | null {
  const usable = records
    .map((r) => ({ ...r, announcedDate: r.announcedDate ?? `${r.year}-05-31` }))
    .filter((r) => r.announcedDate <= valuationDate)
    .sort((a, b) => b.year - a.year);
  return usable[0] ?? null;
}

// 기준시가 = ㎡당 공시지가 × 면적 × 지분 (원 단위 미만 버림)
export function landStandardValue(pricePerSqm: number, area: number, sharePercent = 100): number {
  return Math.floor((pricePerSqm * area * sharePercent) / 100);
}
