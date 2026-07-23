"use client";

import { useState } from "react";
import FileUploadField from "@/components/FileUploadField";

export interface NetAssetResult {
  bookAssets: number;
  bookLiabilities: number;
  reserveAddition: number;
  reserveSubtraction: number;
}

interface Props {
  onResult: (result: NetAssetResult) => void;
}

type Status = "idle" | "loading" | "done" | "error";

export default function NetAssetUpload({ onResult }: Props) {
  const [balanceSheet, setBalanceSheet] = useState<File | null>(null);
  const [reserveSchedule, setReserveSchedule] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [notes, setNotes] = useState("");

  async function handleAnalyze() {
    if (!balanceSheet || !reserveSchedule) return;
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("balanceSheet", balanceSheet);
    formData.append("reserveSchedule", reserveSchedule);

    try {
      const res = await fetch("/api/net-asset", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "분석에 실패했습니다.");

      onResult({
        bookAssets: Math.round(data.bookAssets),
        bookLiabilities: Math.round(data.bookLiabilities),
        reserveAddition: Math.round(data.reserveAddition),
        reserveSubtraction: Math.round(data.reserveSubtraction),
      });
      setNotes(data.notes || "");
      setStatus("done");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.");
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">문서로 AI 자동 계산 (선택)</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <FileUploadField label="재무상태표" file={balanceSheet} onChange={setBalanceSheet} />
        <FileUploadField
          label="자본금과 적립금조정명세서(을)"
          file={reserveSchedule}
          onChange={setReserveSchedule}
        />
      </div>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!balanceSheet || !reserveSchedule || status === "loading"}
        className="btn-secondary self-start text-xs disabled:opacity-40"
      >
        {status === "loading" ? "[업로드중]" : "AI로 세법상 자산총액 계산하기"}
      </button>
      {status === "done" && (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          계산 완료! 아래 입력칸에 자동으로 채워졌어요. 필요하면 직접 수정하세요.
          {notes && <span className="mt-1 block text-zinc-500 dark:text-zinc-400">참고: {notes}</span>}
        </p>
      )}
      {status === "error" && <p className="text-xs text-red-600 dark:text-red-400">{errorMessage}</p>}
    </div>
  );
}
