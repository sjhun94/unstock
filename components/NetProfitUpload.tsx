"use client";

import { useId, useState } from "react";

interface Props {
  yearLabel: string;
  onResult: (netProfitLoss: number) => void;
}

type Status = "idle" | "loading" | "done" | "error";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const UNSUPPORTED_FILE_MESSAGE = "PDF 또는 이미지 파일만 올릴 수 있어요. 엑셀·워드 파일은 PDF로 변환해서 올려주세요.";

function FileUploadField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();
  const [fileError, setFileError] = useState("");

  function handleFileSelect(selected: File | null) {
    if (selected && !ALLOWED_MIME_TYPES.has(selected.type)) {
      setFileError(UNSUPPORTED_FILE_MESSAGE);
      onChange(null);
      return;
    }
    setFileError("");
    onChange(selected);
  }

  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-xs text-zinc-600 dark:text-zinc-300">{label}</span>
      <div className="flex items-center gap-2">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-md border border-zinc-300 bg-white px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          파일 업로드하기
        </label>
        <input
          id={inputId}
          type="file"
          accept="application/pdf,image/*"
          onChange={(e) => handleFileSelect(e.target.files?.[0] ?? null)}
          className="sr-only"
        />
        <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {file ? file.name : "선택된 파일 없음"}
        </span>
      </div>
      {fileError && <p className="text-xs text-red-600 dark:text-red-400">{fileError}</p>}
    </div>
  );
}

export default function NetProfitUpload({ yearLabel, onResult }: Props) {
  const [incomeStatement, setIncomeStatement] = useState<File | null>(null);
  const [taxAdjustment, setTaxAdjustment] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [notes, setNotes] = useState("");

  async function handleAnalyze() {
    if (!incomeStatement || !taxAdjustment) return;
    setStatus("loading");
    setErrorMessage("");

    const formData = new FormData();
    formData.append("incomeStatement", incomeStatement);
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <FileUploadField label="손익계산서" file={incomeStatement} onChange={setIncomeStatement} />
        <FileUploadField label="세무조정계산서" file={taxAdjustment} onChange={setTaxAdjustment} />
      </div>
      <button
        type="button"
        onClick={handleAnalyze}
        disabled={!incomeStatement || !taxAdjustment || status === "loading"}
        className="btn-secondary self-start text-xs disabled:opacity-40"
      >
        {status === "loading" ? "[업로드중]" : "AI로 순손익액 계산하기"}
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
