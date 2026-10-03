"use client";

import type { ReactNode } from "react";

const won = new Intl.NumberFormat("ko-KR");

export function formatWon(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${won.format(Math.round(value))}원`;
}

export function formatPercent(ratio: number) {
  return `${(ratio * 100).toFixed(1)}%`;
}

// 숫자만 남기고(음수 부호·소수점 허용) 저장합니다. 화면에는 천 단위 쉼표를 붙여 보여줍니다.
function sanitizeNumber(raw: string) {
  const negative = raw.trim().startsWith("-");
  const [integer, ...rest] = raw.replace(/[^\d.]/g, "").split(".");
  const fraction = rest.length > 0 ? "." + rest.join("") : "";
  return (negative ? "-" : "") + integer + fraction;
}

function withCommas(value: string) {
  if (value === "" || value === "-") return value;
  const negative = value.startsWith("-");
  const [integer, fraction] = value.replace("-", "").split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (negative ? "-" : "") + grouped + (fraction !== undefined ? "." + fraction : "");
}

// 입력값을 숫자만 남긴 뒤 YYYY-MM-DD 형태로 자동 하이픈을 넣어줍니다.
function formatDateInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export function NumberInput({
  value,
  onChange,
  placeholder = "0",
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      inputMode="decimal"
      value={withCommas(value)}
      onChange={(e) => onChange(sanitizeNumber(e.target.value))}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="input text-right tabular-nums"
    />
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className="input"
    />
  );
}

export function DateInput({
  value,
  onChange,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value}
      onChange={(e) => onChange(formatDateInput(e.target.value))}
      placeholder="YYYY-MM-DD"
      maxLength={10}
      aria-label={ariaLabel}
      className="input tabular-nums"
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300"
      />
      <span>{children}</span>
    </label>
  );
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500 dark:text-zinc-400">{hint}</span>}
    </label>
  );
}

// 표 형태 명세의 한 칸 (작은 라벨 + 입력)
export function MiniField({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1 ${className}`}>
      <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

export function StepSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function SubSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
        {description && <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function Note({ tone = "neutral", children }: { tone?: "neutral" | "warning"; children: ReactNode }) {
  const color =
    tone === "warning"
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
      : "bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300";
  return <p className={`rounded-lg p-3 text-xs leading-relaxed ${color}`}>{children}</p>;
}

export function ResultRow({
  label,
  value,
  emphasize,
  indent,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  indent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <span
        className={
          (emphasize ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400") +
          (indent ? " pl-3" : "")
        }
      >
        {label}
      </span>
      <span
        className={
          "shrink-0 tabular-nums " +
          (emphasize ? "text-base font-bold text-zinc-900 dark:text-zinc-50" : "font-medium text-zinc-800 dark:text-zinc-200")
        }
      >
        {value}
      </span>
    </div>
  );
}

export function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="self-start rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

export function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800"
    >
      삭제
    </button>
  );
}
