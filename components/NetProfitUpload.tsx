"use client";

import { useState } from "react";

interface Props {
  yearLabel: string;
  onResult: (netProfitLoss: number) => void;
}

type Status = "idle" | "loading" | "done" | "error";

export default function NetProfitUpload({ yearLabel, onResult }: Props) {
  const [balanceSheet, setBalanceSheet] = useState<File | null>(null);
  const [taxAdjustment, setTaxAdjustment] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [notes, setNotes] = useState("");

  async function handleAnalyze() {
    if (!balanceSheet || !taxAdjustment) return;
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("balanceSheet", balanceSheet);
    formData.append("taxAdjustment", taxAdjustment);

    try {
      const res = await fetch("/api/net-profit", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");

      onResult(Math.round(data.netProfitLoss));
      setNotes(data.notes || "");
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {yearLabel} 문서로 AI 자동 계산 (선택)
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="flex-1 text-xs text-zinc-600 dark:text-zinc-300">
          재무상태표
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setBalanceSheet(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs"
          />
        </label>
        <label className="flex-1 text-xs text-zinc-600 dark:text-zinc-300">
          세무조정계산서
          <input
            type="file"
            accept="application/pdf,image/*"
            onChange={(e) => setTaxAdjustment(e.target.files?.[0] ?? null)}
            className="mt-1 block w-full text-xs"
          />
        </label>
      </div>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!balanceSheet || !taxAdjustment || status === "loading"}
        className="btn-secondary self-start text-xs disabled:opacity-40"
      >
        {status === "loading" ? "분석 중..." : "AI로 순손익액 계산하기"}
      </button>
      {status === "done" && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          계산 완료! 아래 순손익액 입력칸에 자동으로 채워졌어요. 필요하면 직접 수정하세요.
          {notes && <span className="mt-1 block text-zinc-500 dark:text-zinc-400">참고: {notes}</span>}
        </p>
      )}
      {status === "error" && <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>}
    </div>
  );
}
