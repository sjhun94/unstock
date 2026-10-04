// 개별공시지가 자동 조회: 주소(또는 필지번호) + 평가기준일 → 평가기준일 현재 공시지가와 토지 면적
// 브이월드 API 키는 서버 환경변수(VWORLD_API_KEY)에만 두고, 사용자에게는 결과만 돌려줍니다.
import { NextRequest, NextResponse } from "next/server";
import {
  parseLand,
  parsePrices,
  parseSearch,
  pickPrice,
  type LandPriceRecord,
  type LandPriceResponse,
} from "@/lib/landPrice";

const VWORLD = "https://api.vworld.kr";

// 같은 사용자가 짧은 시간에 너무 많이 조회하지 않도록 제한 (서버 인스턴스별, 1분에 20번)
const hits = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > 20;
}

function reply(body: LandPriceResponse, status = 200) {
  const headers: Record<string, string> = {};
  // 같은 주소·날짜 조회는 하루 동안 CDN에 저장해 API 호출을 아낌
  if (body.kind !== "error") headers["Cache-Control"] = "public, s-maxage=86400, stale-while-revalidate=604800";
  return NextResponse.json(body, { status, headers });
}

async function vworld(path: string, params: Record<string, string>): Promise<unknown> {
  const url = new URL(path, VWORLD);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`vworld ${res.status}`);
  return res.json();
}

export async function GET(request: NextRequest) {
  const key = process.env.VWORLD_API_KEY;
  if (!key) {
    return reply({ kind: "error", code: "not_configured", message: "공시지가 자동 조회가 아직 준비되지 않았어요." }, 503);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return reply({ kind: "error", code: "rate_limited", message: "조회가 너무 잦아요. 잠시 후 다시 시도해 주세요." }, 429);
  }

  const params = request.nextUrl.searchParams;
  const address = (params.get("address") ?? "").trim().slice(0, 100);
  let pnu = (params.get("pnu") ?? "").trim();
  const date = (params.get("date") ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || (!address && !/^\d{19}$/.test(pnu))) {
    return reply({ kind: "error", code: "bad_request", message: "주소와 평가기준일을 확인해 주세요." }, 400);
  }
  const domain = process.env.VWORLD_DOMAIN ?? "";
  const common = { key, domain, format: "json" };

  try {
    let parcelAddress = address;
    if (!pnu) {
      const search = await vworld("/req/search", {
        key,
        service: "search",
        request: "search",
        version: "2.0",
        type: "address",
        category: "parcel",
        query: address,
        size: "10",
        page: "1",
        format: "json",
        errorformat: "json",
      });
      const candidates = parseSearch(search);
      if (candidates.length === 0) {
        return reply({ kind: "error", code: "not_found", message: "주소를 찾지 못했어요. 지번 주소(예: 서울특별시 중구 태평로1가 31)로 입력해 주세요." }, 404);
      }
      if (candidates.length > 1) return reply({ kind: "candidates", candidates });
      pnu = candidates[0].pnu;
      parcelAddress = candidates[0].address;
    }

    // 평가기준일이 속한 해와 그 전 2년의 공시지가를 함께 조회해 평가기준일 현재 고시된 가격을 고름
    const year = Number(date.slice(0, 4));
    const priceResults = await Promise.all(
      [year, year - 1, year - 2].map((y) =>
        vworld("/ned/data/getIndvdLandPriceAttr", { ...common, pnu, stdrYear: String(y), numOfRows: "10", pageNo: "1" }).catch(
          () => null,
        ),
      ),
    );
    const records: LandPriceRecord[] = priceResults.flatMap((json) => (json ? parsePrices(json) : []));
    const picked = pickPrice(records, date);
    if (!picked) {
      return reply({ kind: "error", code: "not_found", message: "이 필지의 개별공시지가를 찾지 못했어요." }, 404);
    }

    const land = await vworld("/ned/data/ladfrlList", { ...common, pnu, numOfRows: "10", pageNo: "1" })
      .then(parseLand)
      .catch(() => ({ area: null, landCategory: null }));

    return reply({
      kind: "result",
      result: {
        pnu,
        address: parcelAddress,
        year: picked.year,
        pricePerSqm: picked.pricePerSqm,
        announcedDate: picked.announcedDate,
        area: land.area,
        landCategory: land.landCategory,
        note:
          picked.year < year
            ? `평가기준일(${date}) 현재 ${year}년 공시지가가 아직 고시되지 않아 ${picked.year}년 가격을 적용했어요.`
            : `${picked.year}년 공시지가(${picked.announcedDate} 공시)를 적용했어요.`,
      },
    });
  } catch {
    return reply({ kind: "error", code: "upstream", message: "공시지가 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, 502);
  }
}
