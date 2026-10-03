"use client";

import { useState } from "react";
import {
  METHOD_LABELS,
  parseBalanceSheet,
  rowsToAccounts,
  type Account,
  type ImportResult,
  type Side,
} from "@/lib/valuation/index.ts";
import { formatWon } from "./ui";

export default function ImportPanel({
  side,
  accounts,
  onChange,
}: {
  side: Side;
  accounts: Account[];
  onChange: (accounts: Account[]) => void;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ImportResult | null>(null);
  const [done, setDone] = useState("");

  function handleText(next: string) {
    setText(next);
    setDone("");
    setParsed(next.trim() ? parseBalanceSheet(next, side) : null);
  }

  function apply(mode: "replace" | "append") {
    if (!parsed || parsed.rows.length === 0) return;
    const imported = rowsToAccounts(parsed.rows);
    const sides = new Set(parsed.rows.map((row) => row.side));
    const kept = mode === "replace" ? accounts.filter((account) => !sides.has(account.side)) : accounts;
    onChange([...kept, ...imported]);
    const assets = parsed.rows.filter((row) => row.side === "asset").length;
    const liabilities = parsed.rows.length - assets;
    setDone(`자산 ${assets}개, 부채 ${liabilities}개 계정을 넣었어요. 아래에서 평가방법을 확인해 주세요.`);
    setText("");
    setParsed(null);
  }

  return (
    <details open className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">
        엑셀에서 재무상태표 붙여넣기
      </summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
          엑셀에서 계정과목과 금액이 있는 열을 함께 선택해 복사(Ctrl+C)한 뒤 아래 칸에 붙여넣으세요(Ctrl+V). 재무상태표
          전체를 붙여넣으면 &apos;부채&apos; 제목 아래는 부채로, &apos;자본&apos; 아래는 제외하고 읽어요. 감가상각누계액·대손충당금은
          바로 위 계정에서 빼고, 합계·소계 줄은 건너뜁니다.
        </p>
        <textarea
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={4}
          placeholder={"보통예금\t200,000,000\n외상매출금\t800,000,000\n..."}
          aria-label="재무상태표 붙여넣기"
          className="input font-mono text-xs"
        />

        {parsed && parsed.rows.length === 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            계정과목과 금액을 찾지 못했어요. 계정명 열과 금액 열을 함께 복사했는지 확인해 주세요.
          </p>
        )}

        {parsed && parsed.rows.length > 0 && (
          <>
            <div className="max-h-64 overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium">구분</th>
                    <th className="px-2 py-1.5 text-left font-medium">계정과목</th>
                    <th className="px-2 py-1.5 text-right font-medium">금액</th>
                    <th className="px-2 py-1.5 text-left font-medium">평가방법</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.map((row, index) => (
                    <tr key={index} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 text-zinc-500">{row.side === "asset" ? "자산" : "부채"}</td>
                      <td className="px-2 py-1.5 text-zinc-800 dark:text-zinc-200">{row.name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{formatWon(row.amount)}</td>
                      <td className="px-2 py-1.5 text-zinc-500">{METHOD_LABELS[row.method]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {parsed.rows.length}개 계정을 찾았어요{parsed.skipped > 0 ? ` (제목·합계·자본 등 ${parsed.skipped}줄 제외)` : ""}.
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => apply("replace")} className="btn-primary">
                기존 계정 지우고 넣기
              </button>
              <button type="button" onClick={() => apply("append")} className="btn-secondary">
                기존 계정에 추가
              </button>
            </div>
          </>
        )}

        {done && <p className="text-xs text-emerald-700 dark:text-emerald-400">{done}</p>}
      </div>
    </details>
  );
}
