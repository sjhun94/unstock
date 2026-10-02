"use client";

import { useState } from "react";
import type { NetIncomeYear, NetIncomeYearResult } from "@/lib/valuation/index.ts";
import { MiniField, Note, NumberInput, ResultRow, StepSection, SubSection, formatWon } from "./ui";

const YEAR_LABELS = ["1년 전 사업연도", "2년 전 사업연도", "3년 전 사업연도"];

type NumericKey = Exclude<keyof NetIncomeYear, "taxMode">;

const ADDITIONS: { key: NumericKey; label: string }[] = [
  { key: "refundInterest", label: "국세·지방세 과오납 환급금 이자" },
  { key: "dividendExclusion", label: "수입배당금 익금불산입액" },
  { key: "donationCarryover", label: "기부금 한도초과 이월액의 손금산입액" },
  { key: "vehicleCarryover", label: "업무용승용차 관련비용 이월 손금추인액" },
  { key: "fxGain", label: "화폐성 외화자산·부채 평가이익" },
];

const DEDUCTIONS: { key: NumericKey; label: string }[] = [
  { key: "fines", label: "벌금·과태료·가산금·체납처분비" },
  { key: "publicCharges", label: "공과금 중 손금불산입액" },
  { key: "nonBusiness", label: "업무와 관련 없는 지출" },
  { key: "vehicleDisallowed", label: "업무용승용차 관련비용 손금불산입액" },
  { key: "withholdingDefault", label: "징수불이행 납부세액" },
  { key: "donationExcess", label: "기부금 한도초과액·비지정기부금" },
  { key: "entertainmentExcess", label: "접대비(기업업무추진비) 한도초과액" },
  { key: "interestDisallowed", label: "지급이자 손금불산입액" },
  { key: "excessiveExpenses", label: "과다경비 등 손금불산입액" },
  { key: "depreciationShortfall", label: "감가상각 시인부족액 (상각부인액 추인분 차감 후)" },
  { key: "fxLoss", label: "화폐성 외화자산·부채 평가손실" },
];

export default function NetIncomeStep({
  years,
  results,
  totalShares,
  onChange,
}: {
  years: NetIncomeYear[];
  results: NetIncomeYearResult[];
  totalShares: string;
  onChange: (index: number, year: NetIncomeYear) => void;
}) {
  const [active, setActive] = useState(0);
  const year = years[active];
  const result = results[active];
  const set = (patch: Partial<NetIncomeYear>) => onChange(active, { ...year, ...patch });
  const numberField = ({ key, label }: { key: NumericKey; label: string }) => (
    <MiniField key={key} label={label}>
      <NumberInput value={year[key]} onChange={(next) => set({ [key]: next })} />
    </MiniField>
  );

  return (
    <StepSection
      title="순손익액"
      description="평가기준일 이전 3개 사업연도의 순손익액을 계산합니다. 사업연도별 세무조정계산서를 보고 입력하세요."
    >
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900" role="tablist">
        {YEAR_LABELS.map((label, index) => (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className={
              "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors " +
              (index === active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                : "text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200")
            }
          >
            {label}
          </button>
        ))}
      </div>

      <MiniField label="각 사업연도 소득금액 (결손이면 음수)">
        <NumberInput value={year.taxableIncome} onChange={(taxableIncome) => set({ taxableIncome })} />
      </MiniField>

      <SubSection
        title="법인세 등 (차감)"
        description="해당 사업연도의 법인세 총결정세액, 농어촌특별세, 지방소득세의 합계입니다. 이월결손금을 공제받았다면 공제가 없었다고 보고 다시 계산한 세액을 넣어야 합니다."
      >
        <div className="flex gap-4 text-sm text-zinc-700 dark:text-zinc-300">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={year.taxMode === "computed"} onChange={() => set({ taxMode: "computed" })} />
            산출세액으로 계산
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={year.taxMode === "direct"} onChange={() => set({ taxMode: "direct" })} />
            합계 직접 입력
          </label>
        </div>
        {year.taxMode === "computed" ? (
          <div className="grid gap-2 sm:grid-cols-3">
            {numberField({ key: "computedTax", label: "산출세액" })}
            {numberField({ key: "creditsNonRural", label: "공제·감면세액 (농특세 비과세)" })}
            {numberField({ key: "creditsRural", label: "공제·감면세액 (농특세 과세)" })}
          </div>
        ) : (
          numberField({ key: "taxDirect", label: "법인세 등 합계" })
        )}
        <ResultRow label="법인세 등" value={formatWon(result.corporateTaxEtc)} />
      </SubSection>

      <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">그 밖의 가산·차감 항목</summary>
        <div className="mt-3 flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">소득금액에 더하는 항목</span>
            <div className="grid gap-2 sm:grid-cols-2">{ADDITIONS.map(numberField)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">소득금액에서 빼는 항목</span>
            <div className="grid gap-2 sm:grid-cols-2">{DEDUCTIONS.map(numberField)}</div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">기타</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {numberField({ key: "capitalChangeEffect", label: "유상증자·감자 효과" })}
              <MiniField label="사업연도 월수">
                <NumberInput value={year.months} onChange={(months) => set({ months })} placeholder="12" />
              </MiniField>
              <MiniField label="사업연도말 주식수">
                <NumberInput value={year.shares} onChange={(shares) => set({ shares })} placeholder={totalShares || "발행주식총수"} />
              </MiniField>
            </div>
          </div>
        </div>
      </details>

      <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
        {results.map((r, index) => (
          <ResultRow key={YEAR_LABELS[index]} label={`${YEAR_LABELS[index]} 순손익액`} value={formatWon(r.annualized)} emphasize={index === active} />
        ))}
      </div>
      <Note>최근 사업연도부터 3 : 2 : 1로 가중평균한 1주당 순손익액을 환원율로 나눠 순손익가치를 구합니다.</Note>
    </StepSection>
  );
}
