"use client";

import { useState } from "react";
import {
  METHOD_LABELS,
  parseBalanceSheet,
  rowsToAccounts,
  type Account,
  type AmountColumn,
  type ImportResult,
  type SheetInfo,
  type Side,
} from "@/lib/valuation/index.ts";
import { formatWon } from "./ui";

export default function ImportPanel({
  side,
  accounts,
  valuationDate,
  fiscalYearEndMonth,
  onChange,
  onSheet,
}: {
  side: Side;
  accounts: Account[];
  valuationDate: string;
  fiscalYearEndMonth: number;
  onChange: (accounts: Account[]) => void;
  onSheet: (sheet: SheetInfo) => void;
}) {
  const [text, setText] = useState("");
  const [column, setColumn] = useState<number | null>(null);
  const [done, setDone] = useState("");

  const options = { valuationDate, fiscalYearEndMonth };
  const parsed = text.trim() ? parseBalanceSheet(text, side, { ...options, column }) : null;
  const selected = parsed?.columns.find((c) => c.index === parsed.column);

  function handleText(next: string) {
    setText(next);
    setColumn(null);
    setDone("");
  }

  function apply(mode: "replace" | "append") {
    if (!parsed || parsed.rows.length === 0) return;
    const imported = rowsToAccounts(parsed.rows);
    const sides = new Set(parsed.rows.map((row) => row.side));
    const kept = mode === "replace" ? accounts.filter((account) => !sides.has(account.side)) : accounts;
    onChange([...kept, ...imported]);
    onSheet({ date: selected?.date ?? null, label: selected?.label ?? "", ...parsed.totals });
    const assets = parsed.rows.filter((row) => row.side === "asset").length;
    const liabilities = parsed.rows.length - assets;
    const basis = selected ? ` (기준: ${selected.label})` : "";
    setDone(`자산 ${assets}개, 부채 ${liabilities}개 계정을 넣었어요${basis}. 아래에서 평가 유형을 확인해 주세요.`);
    setText("");
    setColumn(null);
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
          바로 위 계정에서 빼고, 합계·소계 줄은 건너뜁니다. 여러 시점(분기·연도)이 함께 있으면 어느 시점을 쓸지 골라 드려요.
        </p>
        <textarea
          value={text}
          onChange={(e) => handleText(e.target.value)}
          rows={4}
          placeholder={"과목\t2024.09.30\t2024.06.30\n보통예금\t200,000,000\t180,000,000\n..."}
          aria-label="재무상태표 붙여넣기"
          className="input font-mono text-xs"
        />

        {parsed && parsed.columns.length > 0 && (
          <ColumnPicker
            text={text}
            side={side}
            parsed={parsed}
            options={options}
            valuationDate={valuationDate}
            onPick={setColumn}
          />
        )}

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
                    <th className="px-2 py-1.5 text-left font-medium">평가 유형</th>
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

function ColumnPicker({
  text,
  side,
  parsed,
  options,
  valuationDate,
  onPick,
}: {
  text: string;
  side: Side;
  parsed: ImportResult;
  options: { valuationDate: string; fiscalYearEndMonth: number };
  valuationDate: string;
  onPick: (index: number) => void;
}) {
  const selected = parsed.columns.find((c) => c.index === parsed.column);
  const totals = (column: AmountColumn) => {
    const rows = parseBalanceSheet(text, side, { ...options, column: column.index }).rows;
    const sum = (s: Side) => rows.filter((r) => r.side === s).reduce((acc, r) => acc + r.amount, 0);
    return { asset: sum("asset"), liability: sum("liability") };
  };
  const mismatch = selected?.date && valuationDate && selected.date !== valuationDate;

  return (
    <fieldset className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <legend className="px-1 text-xs font-semibold text-zinc-900 dark:text-zinc-50">
        금액 열이 {parsed.columns.length}개 있어요. 어느 시점의 재무상태표를 쓸까요?
      </legend>
      {parsed.columns.map((column) => {
        const t = totals(column);
        return (
          <label
            key={column.index}
            className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 rounded-md px-2 py-1.5 text-xs hover:bg-zinc-50 dark:hover:bg-zinc-900"
          >
            <input
              type="radio"
              name="bs-column"
              checked={column.index === parsed.column}
              onChange={() => onPick(column.index)}
            />
            <span className="font-medium text-zinc-800 dark:text-zinc-200">{column.label}</span>
            {column.date && <span className="text-zinc-400">기준일 {column.date}</span>}
            <span className="ml-auto tabular-nums text-zinc-500">
              자산 {formatWon(t.asset)} · 부채 {formatWon(t.liability)}
            </span>
          </label>
        );
      })}
      {selected && <ReasonNote reason={parsed.reason} column={selected} valuationDate={valuationDate} />}
      {mismatch && parsed.reason === "manual" && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          고른 시점({selected.date})이 평가기준일({valuationDate})과 달라요. 평가기준일 현재 재무상태표를 쓰는 게 원칙이에요.
        </p>
      )}
    </fieldset>
  );
}

function ReasonNote({ reason, column, valuationDate }: { reason: ImportResult["reason"]; column: AmountColumn; valuationDate: string }) {
  const warn = "text-xs text-amber-700 dark:text-amber-400";
  const info = "text-xs text-zinc-500 dark:text-zinc-400";
  switch (reason) {
    case "valuationDate":
      return <p className="text-xs text-emerald-700 dark:text-emerald-400">평가기준일({valuationDate})과 같은 시점이라 자동으로 골랐어요.</p>;
    case "beforeValuationDate":
      return (
        <p className={warn}>
          평가기준일({valuationDate})과 같은 시점이 없어 그 직전 시점({column.date})을 골랐어요. 원칙은 평가기준일 현재
          재무상태표이니, 그 사이 큰 변동(배당·증자·부동산 매각·차입 등)이 있으면 반영해 주세요.
        </p>
      );
    case "afterValuationDate":
      return (
        <p className={warn}>
          평가기준일({valuationDate}) 이전 시점이 없어 가장 가까운 이후 시점({column.date})을 골랐어요. 평가기준일 현재 재무상태표인지
          확인해 주세요.
        </p>
      );
    case "latest":
      return (
        <p className={info}>
          가장 최근 시점({column.date})을 골랐어요. 기본정보에 평가기준일을 넣으면 그 날짜에 맞는 열을 골라 드려요.
        </p>
      );
    case "current":
      return <p className={info}>&apos;당기&apos; 열을 골랐어요. 평가기준일 현재 재무상태표인지 확인해 주세요.</p>;
    case "first":
      return <p className={warn}>열 머리글에서 시점을 찾지 못해 첫 번째 금액 열을 골랐어요. 맞는 열인지 확인해 주세요.</p>;
    default:
      return null;
  }
}
