"use client";

import { useState, type ReactNode } from "react";
import type { RowImport } from "@/lib/valuation/index.ts";

export interface PreviewColumn<T> {
  label: string;
  render: (row: T) => ReactNode;
  align?: "right";
}

export default function RowPastePanel<T>({
  title,
  description,
  placeholder,
  parse,
  columns,
  hasExisting,
  onApply,
}: {
  title: string;
  description: string;
  placeholder: string;
  parse: (text: string) => RowImport<T>;
  columns: PreviewColumn<T>[];
  hasExisting: boolean;
  onApply: (rows: T[], mode: "replace" | "append") => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<RowImport<T> | null>(null);
  const [done, setDone] = useState("");

  function handleText(next: string) {
    setText(next);
    setDone("");
    setParsed(next.trim() ? parse(next) : null);
  }

  function apply(mode: "replace" | "append") {
    if (!parsed || parsed.rows.length === 0) return;
    onApply(parsed.rows, mode);
    setDone(`${parsed.rows.length}건을 넣었어요.`);
    setText("");
    setParsed(null);
  }

  return (
    <details className="rounded-lg border border-zinc-300 p-3 dark:border-zinc-700">
      <summary className="cursor-pointer text-xs font-semibold text-zinc-800 dark:text-zinc-100">{title}</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
        <textarea
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={3}
          placeholder={placeholder}
          aria-label={title}
          className="input font-mono text-xs"
        />

        {parsed && parsed.rows.length === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            읽을 수 있는 줄이 없어요. 날짜와 금액이 있는 열을 함께 복사했는지 확인해 주세요.
          </p>
        )}

        {parsed && parsed.rows.length > 0 && (
          <>
            <div className="max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.label} className={`px-2 py-1.5 font-medium ${column.align === "right" ? "text-right" : "text-left"}`}>
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, index) => (
                    <tr key={index} className="border-t border-zinc-100 dark:border-zinc-800">
                      {columns.map((column) => (
                        <td
                          key={column.label}
                          className={`px-2 py-1.5 text-zinc-800 dark:text-zinc-200 ${column.align === "right" ? "text-right tabular-nums" : ""}`}
                        >
                          {column.render(row)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {parsed.rows.length}건을 찾았어요{parsed.skipped > 0 ? ` (제목·합계 등 ${parsed.skipped}줄 제외)` : ""}.
            </p>
            <div className="flex flex-wrap gap-2">
              {hasExisting ? (
                <>
                  <button type="button" onClick={() => apply("replace")} className="btn-primary">
                    기존 명세 지우고 넣기
                  </button>
                  <button type="button" onClick={() => apply("append")} className="btn-secondary">
                    기존 명세에 추가
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => apply("append")} className="btn-primary">
                  명세에 넣기
                </button>
              )}
            </div>
          </>
        )}

        {done && <p className="text-xs text-emerald-700 dark:text-emerald-400">{done}</p>}
      </div>
    </details>
  );
}
