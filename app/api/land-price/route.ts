// 공시가격 자동 조회: 주소(또는 필지번호) + 평가기준일 → 평가기준일 현재 고시된 가격
//   type=land(기본): 개별공시지가 + 토지대장 면적
//   type=apartment: 공동주택가격 (동·호 지정)
//   type=house: 개별주택가격
// 브이월드 API 키는 서버 환경변수(VWORLD_API_KEY)에만 두고, 사용자에게는 결과만 돌려줍니다.
import { NextRequest, NextResponse } from "next/server";
import {
  parseHousingPrices,
  parseLand,
  parsePrices,
  parseSearch,
  pickPrice,
  type HousingType,
  type LandPriceRecord,
  type LandPriceResponse,
} from "@/lib/landPrice";

const VWORLD = "https://api.vworld.kr";

// 브이월드는 해외에서 오는 요청을 막는 경우가 있어 이 라우트는 서울 리전에서 실행 (vercel.json에서도 icn1 지정)
export const preferredRegion = "icn1";

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
  if (!res.ok) throw new Error(`vworld ${path} HTTP ${res.status}`);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    // 키 오류 등은 JSON이 아닌 안내문으로 올 때가 있음 (키 값은 기록하지 않음)
    throw new Error(`vworld ${path} non-JSON: ${text.slice(0, 200)}`);
  }
}

const HOUSING: Record<HousingType, { path: string; label: string }> = {
  apartment: { path: "/ned/data/getApartHousingPriceAttr", label: "공동주택가격" },
  house: { path: "/ned/data/getIndvdHousingPriceAttr", label: "개별주택가격" },
};

export async function GET(request: NextRequest) {
  const key = process.env.VWORLD_API_KEY;
  if (!key) {
    return reply({ kind: "error", code: "not_configured", message: "공시가격 자동 조회가 아직 준비되지 않았어요." }, 503);
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return reply({ kind: "error", code: "rate_limited", message: "조회가 너무 잦아요. 잠시 후 다시 시도해 주세요." }, 429);
  }

  const params = request.nextUrl.searchParams;
  const type = params.get("type") ?? "land";
  const address = (params.get("address") ?? "").trim().slice(0, 100);
  let pnu = (params.get("pnu") ?? "").trim();
  const date = (params.get("date") ?? "").trim();
  const dong = (params.get("dong") ?? "").replace(/동$/, "").trim().slice(0, 20);
  const ho = (params.get("ho") ?? "").replace(/호$/, "").trim().slice(0, 20);
  if (
    !["land", "apartment", "house"].includes(type) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (!address && !/^\d{19}$/.test(pnu)) ||
    (type === "apartment" && !ho)
  ) {
    return reply({ kind: "error", code: "bad_request", message: "주소·평가기준일(공동주택은 호수까지)을 확인해 주세요." }, 400);
  }
  // 브이월드 인증키에 등록한 서비스 URL (공개 정보)
  const domain = process.env.VWORLD_DOMAIN ?? "https://unstock-two.vercel.app";
  const common = { key, domain, format: "json" };
  const year = Number(date.slice(0, 4));
  const years = [year, year - 1, year - 2];

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
      // 입력한 주소와 정확히 같은 필지가 있으면 바로 그 필지를 씀
      const plain = (text: string) => text.replace(/\s/g, "");
      const exact = candidates.find((c) => plain(c.address) === plain(address));
      if (!exact && candidates.length > 1) return reply({ kind: "candidates", candidates });
      pnu = (exact ?? candidates[0]).pnu;
      parcelAddress = (exact ?? candidates[0]).address;
    }

    if (type === "apartment" || type === "house") {
      const housing = HOUSING[type];
      const results = await Promise.all(
        years.map((y) =>
          vworld(housing.path, {
            ...common,
            pnu,
            stdrYear: String(y),
            ...(type === "apartment" ? { hoNm: ho, ...(dong ? { dongNm: dong } : {}) } : {}),
            numOfRows: "10",
            pageNo: "1",
          }).catch(() => null),
        ),
      );
      const picked = pickPrice(results.flatMap((json) => (json ? parseHousingPrices(json) : [])), date, "04-30");
      if (!picked) {
        const what = type === "apartment" ? "이 동·호의 공동주택가격" : "이 주소의 개별주택가격";
        return reply({ kind: "error", code: "not_found", message: `${what}을 찾지 못했어요. 주소와 동·호를 확인해 주세요.` }, 404);
      }
      return reply({
        kind: "housing",
        result: {
          pnu,
          address: parcelAddress,
          type,
          year: picked.year,
          price: picked.price,
          announcedDate: picked.announcedDate,
          area: picked.area,
          name: picked.name,
          note:
            picked.year < year
              ? `평가기준일(${date}) 현재 ${year}년 ${housing.label}이 아직 공시되지 않아 ${picked.year}년 가격을 적용했어요.`
              : `${picked.year}년 ${housing.label}을 적용했어요.`,
        },
      });
    }

    // 평가기준일이 속한 해와 그 전 2년의 공시지가를 함께 조회해 평가기준일 현재 고시된 가격을 고름
    const priceResults = await Promise.all(
      years.map((y) =>
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
  } catch (error) {
    console.error("[land-price]", error instanceof Error ? `${error.message} ${String(error.cause ?? "")}` : error);
    return reply({ kind: "error", code: "upstream", message: "공시가격 서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요." }, 502);
  }
}
