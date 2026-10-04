"use client";

import type { ReviewItem, ReviewLevel, ReviewStep } from "@/lib/valuation/index.ts";

const LEVEL: Record<ReviewLevel, { icon: string; label: string; tone: string }> = {
  request: { icon: "●", label: "자료 요청", tone: "text-red-600 dark:text-red-400" },
  mismatch: { icon: "▲", label: "불일치", tone: "text-amber-600 dark:text-amber-400" },
  check: { icon: "?", label: "확인", tone: "text-sky-600 dark:text-sky-400" },
  done: { icon: "✓", label: "완료", tone: "text-emerald-600 dark:text-emerald-400" },
};

export const STEP_LABEL: Record<ReviewStep, string> = {
  basic: "기본정보",
  balanceSheet: "재무상태표",
  assets: "자산 평가",
  liabilities: "부채 평가",
  adjustments: "유보·조정",
  netIncome: "순손익액",
  judgment: "평가방법",
};

export default function ReviewPanel({
  items,
  onJump,
  onDismiss,
}: {
  items: ReviewItem[];
  onJump: (step: ReviewStep) => void;
  onDismiss: (id: string) => void;
}) {
  const open = items.filter((item) => item.level !== "done");
  const done = items.filter((item) => item.level === "done");
  const documents = [...new Set(items.filter((i) => i.level === "request" && i.document).map((i) => i.document!))];
  const count = (level: ReviewLevel) => items.filter((i) => i.level === level).length;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800" aria-label="검토 사항">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">검토 사항</h2>
        <span className="text-xs text-zinc-500 dark:text-zinc-400">
          {open.length === 0 ? "모두 확인했어요" : `${open.length}건 남음`}
        </span>
      </div>
      {open.length > 0 && (
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {(["request", "mismatch", "check"] as ReviewLevel[]).map(
            (level) =>
              count(level) > 0 && (
                <span key={level} className={LEVEL[level].tone}>
                  {LEVEL[level].icon} {LEVEL[level].label} {count(level)}
                </span>
              ),
          )}
        </p>
      )}

      <ul className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
        {open.map((item) => (
          <li key={item.id} className="flex flex-col gap-1 rounded-lg bg-zinc-50 p-2 text-xs dark:bg-zinc-900">
            <button type="button" onClick={() => onJump(item.step)} className="flex gap-1.5 text-left">
              <span className={`shrink-0 ${LEVEL[item.level].tone}`}>{LEVEL[item.level].icon}</span>
              <span className="font-medium text-zinc-800 hover:underline dark:text-zinc-100">{item.title}</span>
            </button>
            {item.detail && <p className="pl-4 leading-relaxed text-zinc-500 dark:text-zinc-400">{item.detail}</p>}
            {item.document && <p className="pl-4 text-zinc-600 dark:text-zinc-300">📄 {item.document}</p>}
            <div className="flex items-center justify-between gap-2 pl-4">
              <span className="text-zinc-400">{STEP_LABEL[item.step]}</span>
              {item.dismissible && (
                <button
                  type="button"
                  onClick={() => onDismiss(item.id)}
                  className="rounded border border-zinc-300 px-1.5 py-0.5 text-zinc-600 hover:bg-white dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  확인했어요
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>

      {documents.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-200">준비할 자료 {documents.length}개</summary>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-zinc-600 dark:text-zinc-300">
            {documents.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </details>
      )}

      {done.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-emerald-700 dark:text-emerald-400">완료 {done.length}건</summary>
          <ul className="mt-1 flex flex-col gap-0.5 pl-1 text-zinc-600 dark:text-zinc-300">
            {done.map((d) => (
              <li key={d.id}>✓ {d.title}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
