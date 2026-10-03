"use client";

import { num, type BasicInfo } from "@/lib/valuation/index.ts";
import { DateInput, Field, NumberInput, StepSection, TextInput, formatWon } from "./ui";

export default function BasicInfoStep({ value, onChange }: { value: BasicInfo; onChange: (value: BasicInfo) => void }) {
  const set = (patch: Partial<BasicInfo>) => onChange({ ...value, ...patch });

  return (
    <StepSection title="기본정보" description="평가 대상 회사의 기본 정보를 입력하세요.">
      <Field label="법인명">
        <TextInput value={value.companyName} onChange={(companyName) => set({ companyName })} placeholder="예: (주)예시" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="1주당 액면가액">
          <NumberInput value={value.parValue} onChange={(parValue) => set({ parValue })} placeholder="예: 5,000" />
        </Field>
        <Field label="발행주식총수" hint="1주당 금액을 계산하려면 필요합니다.">
          <NumberInput value={value.totalShares} onChange={(totalShares) => set({ totalShares })} placeholder="예: 10,000" />
        </Field>
      </div>
      <Field label="자본금 (자동계산)">
        <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {formatWon(num(value.parValue) * num(value.totalShares))}
          <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">(액면가액 × 발행주식총수)</span>
        </p>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="사업개시일" hint="평가기준일까지 3년이 안 되면 순자산가치만으로 평가합니다.">
          <DateInput value={value.businessStartDate} onChange={(businessStartDate) => set({ businessStartDate })} />
        </Field>
        <Field label="평가기준일" hint="재무상태표 기준일과 같은 날로 입력하세요.">
          <DateInput value={value.valuationDate} onChange={(valuationDate) => set({ valuationDate })} />
        </Field>
      </div>
      <Field label="결산월" hint="사업연도가 끝나는 달입니다. 감가상각 재계산에 사용됩니다.">
        <select
          value={value.fiscalYearEndMonth}
          onChange={(e) => set({ fiscalYearEndMonth: e.target.value })}
          className="input"
        >
          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((month) => (
            <option key={month} value={month}>
              {month}월
            </option>
          ))}
        </select>
      </Field>
    </StepSection>
  );
}
