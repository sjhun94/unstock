"use client";

import { useState } from "react";
import type { HousingPriceResult, HousingType, LandCandidate, LandPriceResponse } from "@/lib/landPrice";
import { MiniField, NumberInput, formatWon } from "./ui";

// 주택 주소(공동주택은 동·호까지)로 평가기준일 현재 주택 공시가격을 찾아 기준시가를 채워 줌
export default function HousingPriceLookup({
  valuationDate,
  onApply,
}: {
  valuationDate: string;
  onApply: (value: number, mode: "set" | "add") => void;
}) {
  const [type, setType] = useState<HousingType>("apartment");
  const [address, setAddress] = useState("");
  const [dong, setDong] = useState("");
  const [ho, setHo] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; notConfigured: boolean } | null>(null);
  const [candidates, setCandidates] = useState<LandCandidate[]>([]);
  const [result, setResult] = useState<HousingPriceResult | null>(null);
  const [share, setShare] = useState("100");
  const [done, setDone] = useState("");

  async function lookup(query: { address?: string; pnu?: string }) {
    if (!valuationDate) {
      setError({ message: "기본정보에 평가기준일을 먼저 입력해 주세요.", notConfigured: false });
      return;
    }
    if (type === "apartment" && !ho.trim()) {
      setError({ message: "공동주택은 호수를 입력해 주세요.", notConfigured: false });
      return;
    }
    setLoading(true);
    setError(null);
    setDone("");
    try {
      const params = new URLSearchParams({ type, date: valuationDate });
      if (query.pnu) params.set("pnu", query.pnu);
      if (query.address) params.set("address", query.address);
      if (type === "apartment") {
        params.set("ho", ho.trim());
        if (dong.trim()) params.set("dong", dong.trim());
      }
      const res = await fetch(`/api/land-price?${params}`);
      const body = (await res.json()) as LandPriceResponse;
      if (body.kind === "candidates") {
        setCandidates(body.candidates);
        setResult(null);
      } else if (body.kind === "housing") {
        setCandidates([]);
        setResult(body.result);
      } else if (body.kind === "error") {
        setError({ message: body.message, notConfigured: body.code === "not_configured" });
      }
    } catch {
      setError({ message: "조회 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.", notConfigured: false });
    } finally {
      setLoading(false);
    }
  }

  const total = result ? Math.floor((result.price * (Number(share) || 0)) / 100) : 0;

  return (
    <details className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-100">주소로 주택 공시가격 찾기</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          주택은 토지와 건물을 합친 공시가격이 기준시가예요. 재무상태표에 같은 주택의 토지·건물이 따로 있으면, 한 계정에 공시가격
          전체를 넣고 다른 계정은 0원으로 하거나 장부가액 비율로 나눠 넣어 주세요. 사무실·상가·공장 같은 일반 건물은 공시가격이 없어
          조회되지 않아요.
        </p>
        <div className="flex gap-4 text-xs text-zinc-700 dark:text-zinc-300">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={type === "apartment"} onChange={() => setType("apartment")} />
            아파트·연립·다세대
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={type === "house"} onChange={() => setType("house")} />
            단독·다가구
          </label>
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (address.trim()) lookup({ address: address.trim() });
          }}
        >
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="지번 주소 예: 서울특별시 강남구 대치동 316"
            aria-label="주택 지번 주소"
            className="input text-sm"
          />
          <div className="flex gap-2">
            {type === "apartment" && (
              <>
                <input
                  value={dong}
                  onChange={(e) => setDong(e.target.value)}
                  placeholder="동 (예: 101, 없으면 비움)"
                  aria-label="동"
                  className="input min-w-0 flex-1 text-sm"
                />
                <input
                  value={ho}
                  onChange={(e) => setHo(e.target.value)}
                  placeholder="호 (예: 503)"
                  aria-label="호"
                  className="input min-w-0 flex-1 text-sm"
                />
              </>
            )}
            <button type="submit" disabled={loading || !address.trim()} className="btn-secondary shrink-0 disabled:opacity-40">
              {loading ? "찾는 중…" : "찾기"}
            </button>
          </div>
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
              {result.name && ` · ${result.name}`}
              {result.area !== null && ` · ${result.area}㎡`}
            </p>
            <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
              공시가격 {formatWon(result.price)} · {result.note}
            </p>
            <MiniField label="회사 소유 지분 (%)">
              <NumberInput value={share} onChange={setShare} placeholder="100" />
            </MiniField>
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
                기준시가에 더하기 (여러 채)
              </button>
            </div>
            <p className="text-xs text-zinc-400">출처: 국토교통부 주택가격 공시 (브이월드)</p>
          </div>
        )}
        {done && <p className="text-xs text-emerald-700 dark:text-emerald-400">{done}</p>}
      </div>
    </details>
  );
}
