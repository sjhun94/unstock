"use client";

import { useState, type ReactNode } from "react";
import {
  fiscalYearEnds,
  parseIncomeAdjustments,
  parseTaxReturn,
  taxReturnPatch,
  yearIndexOf,
  type FiscalPeriod,
  type IncomeAdjustmentResult,
  type NetIncomeYear,
  type NetIncomeYearResult,
  type TaxReturnResult,
} from "@/lib/valuation/index.ts";
import { MiniField, Note, NumberInput, ResultRow, StepSection, SubSection, formatWon } from "./ui";

type NumericKey = Exclude<keyof NetIncomeYear, "taxMode" | "adjustmentsPasted" | "period" | "lossCarryforward">;

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

const FIELD_LABEL = new Map<string, string>([...ADDITIONS, ...DEDUCTIONS].map((f) => [f.key, f.label]));

export default function NetIncomeStep({
  years,
  results,
  totalShares,
  valuationDate,
  fiscalYearEndMonth,
  onChange,
}: {
  years: NetIncomeYear[];
  results: NetIncomeYearResult[];
  totalShares: string;
  valuationDate: string;
  fiscalYearEndMonth: number;
  onChange: (index: number, year: NetIncomeYear) => void;
}) {
  const [active, setActive] = useState(0);
  const year = years[active];
  const result = results[active];
  const ends = fiscalYearEnds(valuationDate, fiscalYearEndMonth);
  const yearLabel = (index: number) => (ends ? `${ends[index].slice(0, 4)}년 (${index + 1}년 전)` : `${index + 1}년 전 사업연도`);
  const set = (patch: Partial<NetIncomeYear>) => onChange(active, { ...year, ...patch });
  const numberField = ({ key, label }: { key: NumericKey; label: string }) => (
    <MiniField key={key} label={label}>
      <NumberInput value={year[key]} onChange={(next) => set({ [key]: next })} />
    </MiniField>
  );

  // 신고서의 사업연도를 보고 어느 칸에 넣을지 정함 (못 찾으면 지금 보고 있는 칸)
  const targetOf = (period: FiscalPeriod | null) =>
    (period && yearIndexOf(period.end, valuationDate, fiscalYearEndMonth)) ?? active;
  const applyTo = (index: number, patch: Partial<NetIncomeYear>) => {
    onChange(index, { ...years[index], ...patch });
    setActive(index);
  };

  return (
    <StepSection
      title="순손익액"
      description="평가기준일 이전 3개 사업연도의 순손익액을 계산합니다. 사업연도마다 법인세 신고서의 두 서식을 붙여넣으면 나머지는 자동으로 채워져요."
    >
      <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900" role="tablist">
        {years.map((y, index) => (
          <button
            key={index}
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
            {yearLabel(index)}
            {y.taxableIncome.trim() !== "" && " ✓"}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <PasteBox<TaxReturnResult>
          title="① 법인세 과세표준 및 세액조정계산서 붙여넣기"
          description="신고서 PDF나 엑셀에서 서식 전체를 복사해 붙여넣으세요. 사업연도를 읽어 맞는 칸에 넣고, 각 사업연도 소득금액·산출세액·공제감면세액을 채워요."
          placeholder={"사업연도 2023.01.01 ~ 2023.12.31\n⑩ 각 사업연도 소득금액  150,000,000\n⑬ 과세표준  150,000,000\n⑯ 산출세액  13,500,000\n..."}
          parse={parseTaxReturn}
          canApply={(r) => r.taxableIncome !== null}
          onApply={(r) => applyTo(targetOf(r.period), taxReturnPatch(r))}
          preview={(r) => (
            <>
              <PeriodLine period={r.period} target={yearLabel(targetOf(r.period))} />
              <ul className="flex flex-col gap-0.5 text-xs tabular-nums text-zinc-700 dark:text-zinc-300">
                {r.found.map((f) => (
                  <li key={f.label} className="flex justify-between gap-3">
                    <span>{f.label}</span>
                    <span>{formatWon(f.amount)}</span>
                  </li>
                ))}
              </ul>
              {r.recomputedTax !== null && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  이월결손금 {formatWon(r.lossCarryforward ?? 0)}을 공제받았어요. 상증세법은 공제 전 세액을 쓰므로 산출세액을{" "}
                  {formatWon(r.recomputedTax)}으로 다시 계산해 넣을게요.
                </p>
              )}
              {r.taxableIncome === null && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  &apos;각 사업연도 소득금액&apos; 줄을 찾지 못했어요. 서식 전체를 복사했는지 확인해 주세요.
                </p>
              )}
            </>
          )}
        />
        <PasteBox<IncomeAdjustmentResult>
          title="② 소득금액조정합계표 붙여넣기"
          description="세무조정 항목 중 상증세법상 더하거나 빼야 하는 항목(기업업무추진비 한도초과, 벌금, 수입배당금 익금불산입 등)을 골라 자동으로 넣어요. 나머지는 각 사업연도 소득에 이미 들어 있어 따로 반영하지 않아요."
          placeholder={"익금산입 및 손금불산입\t\t\t손금산입 및 익금불산입\n과목\t금액\t처분\t과목\t금액\t처분\n기업업무추진비한도초과\t5,000,000\t기타사외유출\t감가상각비손금추인\t1,000,000\t유보\n..."}
          parse={parseIncomeAdjustments}
          canApply={(r) => r.items.length > 0}
          onApply={(r) => applyTo(targetOf(r.period), r.patch)}
          preview={(r) => (
            <>
              <PeriodLine period={r.period} target={yearLabel(targetOf(r.period))} />
              <div className="max-h-56 overflow-auto rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">구분</th>
                      <th className="px-2 py-1.5 text-left font-medium">과목</th>
                      <th className="px-2 py-1.5 text-right font-medium">금액</th>
                      <th className="px-2 py-1.5 text-left font-medium">순손익액 반영</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.items.map((item, index) => (
                      <tr key={index} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-2 py-1.5 text-zinc-500">{item.side === "plus" ? "손금불산입" : "손금산입"}</td>
                        <td className="px-2 py-1.5 text-zinc-800 dark:text-zinc-200">{item.name}</td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">{formatWon(item.amount)}</td>
                        <td className={`px-2 py-1.5 ${item.field ? "text-emerald-700 dark:text-emerald-400" : "text-zinc-400"}`}>
                          {item.field ? FIELD_LABEL.get(item.field) : "반영 안 함 (소득에 포함)"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        />
      </div>

      {(year.period || year.lossCarryforward) && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {year.period && `붙여넣은 신고서 사업연도: ${year.period}`}
          {year.lossCarryforward && ` · 이월결손금 ${formatWon(Number(year.lossCarryforward))} 공제 전 세액으로 계산`}
        </p>
      )}

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

      <details className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800" open={year.adjustmentsPasted}>
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
          <ResultRow key={index} label={`${yearLabel(index)} 순손익액`} value={formatWon(r.annualized)} emphasize={index === active} />
        ))}
      </div>
      <Note>최근 사업연도부터 3 : 2 : 1로 가중평균한 1주당 순손익액을 환원율로 나눠 순손익가치를 구합니다.</Note>
    </StepSection>
  );
}

function PeriodLine({ period, target }: { period: FiscalPeriod | null; target: string }) {
  return (
    <p className="text-xs text-zinc-600 dark:text-zinc-300">
      {period ? `사업연도 ${period.start} ~ ${period.end} → ` : "사업연도를 찾지 못해 지금 보고 있는 "}
      <b>{target}</b> 칸에 넣을게요.
    </p>
  );
}

function PasteBox<T>({
  title,
  description,
  placeholder,
  parse,
  canApply,
  onApply,
  preview,
}: {
  title: string;
  description: string;
  placeholder: string;
  parse: (text: string) => T;
  canApply: (result: T) => boolean;
  onApply: (result: T) => void;
  preview: (result: T) => ReactNode;
}) {
  const [text, setText] = useState("");
  const [done, setDone] = useState(false);
  const parsed = text.trim() ? parse(text) : null;

  return (
    <details className="rounded-xl border border-zinc-300 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</summary>
      <div className="mt-3 flex flex-col gap-3">
        <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{description}</p>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDone(false);
          }}
          rows={4}
          placeholder={placeholder}
          aria-label={title}
          className="input font-mono text-xs"
        />
        {parsed && preview(parsed)}
        {parsed && (
          <div>
            <button
              type="button"
              disabled={!canApply(parsed)}
              onClick={() => {
                onApply(parsed);
                setText("");
                setDone(true);
              }}
              className="btn-primary disabled:opacity-40"
            >
              순손익액에 넣기
            </button>
          </div>
        )}
        {done && <p className="text-xs text-emerald-700 dark:text-emerald-400">넣었어요. 아래 칸에서 확인해 주세요.</p>}
      </div>
    </details>
  );
}
