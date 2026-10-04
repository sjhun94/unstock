"use client";

import { useState } from "react";
import { landStandardValue, type LandCandidate, type LandPriceResponse, type LandPriceResult } from "@/lib/landPrice";
import { MiniField, NumberInput, formatWon } from "./ui";

// 토지 주소로 평가기준일 현재 개별공시지가를 찾아 기준시가(공시지가 × 면적 × 지분)를 채워 줌
export default function LandPriceLookup({
  valuationDate,
  onApply,
}: {
  valuationDate: string;
  onApply: (value: number, mode: "set" | "add") => void;
}) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  const [candidates, setCandidates] = useState<LandCandidate[]>([]);
  const [result, setResult] = useState<LandPriceResult | null>(null);
  const [area, setArea] = useState("");
  const [share, setShare] = useState("100");
  const [done, setDone] = useState("");

  async function lookup(query: { address?: string; pnu?: string }) {
    if (!valuationDate) {
      setError({ message: "기본정보에 평가기준일을 먼저 입력해 주세요.", notConfigured: false });
      return;
    }
    setLoading(true);
    setError(null);
    setDone("");
    try {
      const params = new URLSearchParams({ date: valuationDate, ...(query.pnu ? { pnu: query.pnu } : { address: query.address ?? "" }) });
      if (query.pnu && query.address) params.set("address", query.address);
      const res = await fetch(`/api/land-price?${params}`);
      const body = (await res.json()) as LandPriceResponse;
      if (body.kind === "candidates") {
        setCandidates(body.candidates);
        setResult(null);
      } else if (body.kind === "result") {
        setCandidates([]);
        setResult(body.result);
        setArea(body.result.area !== null ? String(body.result.area) : "");
      } else {
        setError({ message: body.message, notConfigured: body.code === "not_configured" });
      }
    } catch {
      setError({ message: "조회 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", notConfigured: false });
    } finally {
      setLoading(false);
    }
  }

  const total = result ? landStandardValue(result.pricePerSqm, Number(area) || 0, Number(share) || 0) : 0;

  return (
    <details className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-100">주소로 개별공시지가 찾기</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          토지의 지번 주소를 넣으면 평가기준일 현재 고시된 개별공시지가와 토지대장 면적을 찾아 기준시가를 계산해요. 필지가 여러
          개면 하나씩 조회해 &apos;더하기&apos;를 누르세요.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (address.trim()) lookup({ address: address.trim() });
          }}
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="예: 서울특별시 중구 태평로1가 31"
            aria-label="토지 지번 주소"
            className="input flex-1 text-sm"
          />
          <button type="submit" disabled={loading || !address.trim()} className="btn-secondary disabled:opacity-40">
            {loading ? "찾는 중…" : "찾기"}
          </button>
        </form>

        {error && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {error.message}
            {error.notConfigured && (
              <>
                {" "}
                그동안은{" "}
                <a href="https://www.realtyprice.kr" target="_blank" rel="noreferrer" className="underline">
                  부동산공시가격알리미
                </a>
                에서 확인해 입력해 주세요.
              </>
            )}
          </p>
        )}

        {candidates.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-zinc-600 dark:text-zinc-300">주소가 여러 개예요. 맞는 필지를 골라 주세요.</span>
            {candidates.map((c) => (
              <button
                key={c.pnu}
                type="button"
                onClick={() => lookup({ pnu: c.pnu, address: c.address })}
                className="rounded-md border border-zinc-200 px-2 py-1 text-left text-xs hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
              >
                {c.address}
              </button>
            ))}
          </div>
        )}

        {result && (
          <div className="flex flex-col gap-2 rounded-md bg-zinc-50 p-2 dark:bg-zinc-900">
            <p className="text-xs text-zinc-700 dark:text-zinc-200">
              <b>{result.address}</b>
              {result.landCategory && ` (${result.landCategory})`}
            </p>
            <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
              ㎡당 {formatWon(result.pricePerSqm)} · {result.note}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <MiniField label="면적 (㎡)">
                <NumberInput value={area} onChange={setArea} placeholder={result.area === null ? "토지대장 면적 입력" : ""} />
              </MiniField>
              <MiniField label="회사 소유 지분 (%)">
                <NumberInput value={share} onChange={setShare} placeholder="100" />
              </MiniField>
            </div>
            <p className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-50">기준시가 {formatWon(total)}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={total <= 0}
                onClick={() => {
                  onApply(total, "set");
                  setDone("기준시가 칸에 넣었어요.");
                }}
                className="btn-primary disabled:opacity-40"
              >
                기준시가 칸에 넣기
              </button>
              <button
                type="button"
                disabled={total <= 0}
                onClick={() => {
                  onApply(total, "add");
                  setDone("기준시가에 더했어요.");
                }}
                className="btn-secondary disabled:opacity-40"
              >
                기준시가에 더하기 (여러 필지)
              </button>
            </div>
            <p className="text-xs text-zinc-400">출처: 국토교통부 개별공시지가·토지대장 (브이월드)</p>
          </div>
        )}
        {done && <p className="text-xs text-emerald-700 dark:text-emerald-400">{done}</p>}
      </div>
    </details>
  );
}
