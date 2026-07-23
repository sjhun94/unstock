"use client";

import { useId, useState } from "react";

export const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "text/plain",
]);

export const UNSUPPORTED_FILE_MESSAGE =
  "PDF 또는 이미지 파일만 올릴 수 있어요. 엑셀·워드 파일은 PDF로 변환해서 올려주세요.";

export default function FileUploadField({
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
    if (selected && !ALLOWED_DOCUMENT_MIME_TYPES.has(selected.type)) {
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
