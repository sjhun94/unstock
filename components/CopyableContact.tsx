"use client";

import { useState } from "react";

export default function CopyableContact({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 클립보드 접근이 막힌 환경(권한 거부 등)에서는 조용히 무시합니다.
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="text-zinc-600 dark:text-zinc-300">
        <span className="text-zinc-400 dark:text-zinc-500">{label}</span> {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 rounded-full border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        {copied ? "복사됨!" : "복사"}
      </button>
    </div>
  );
}
