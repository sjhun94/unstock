"use client";

import { useState } from "react";
import {
  calculateValuation,
  createInitialState,
  num,
  type NetIncomeYear,
  type ValuationState,
} from "@/lib/valuation/index.ts";
import BalanceSheetStep from "@/components/wizard/BalanceSheetStep";
import EvaluationStep from "@/components/wizard/EvaluationStep";
import AdjustmentsStep from "@/components/wizard/AdjustmentsStep";
import BasicInfoStep from "@/components/wizard/BasicInfoStep";
import JudgmentStep from "@/components/wizard/JudgmentStep";
import NetIncomeStep from "@/components/wizard/NetIncomeStep";
import ResultStep from "@/components/wizard/ResultStep";
import { formatWon } from "@/components/wizard/ui";

const STEPS = ["기본정보", "재무상태표", "자산 평가", "부채 평가", "유보·조정", "순손익액", "평가방법", "결과"] as const;

export default function ValuationWizard({ onExitToLanding }: { onExitToLanding?: () => void }) {
  const [step, setStep] = useState(0);
  const [state, setState] = useState<ValuationState>(createInitialState);

  const result = calculateValuation(state);
  const values = new Map(result.accounts.map((account) => [account.id, account.value]));
  const context = {
    valuationDate: state.basic.valuationDate,
    fiscalYearEndMonth: num(state.basic.fiscalYearEndMonth) || 12,
  };

  const isResultStep = step === STEPS.length - 1;

  function goNext() {
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    if (step === 0) onExitToLanding?.();
    else setStep((s) => s - 1);
  }

  function reset() {
    if (!window.confirm("입력한 내용이 모두 지워집니다. 처음부터 다시 시작할까요?")) return;
    setState(createInitialState());
    setStep(0);
  }

  function setNetIncomeYear(index: number, year: NetIncomeYear) {
    setState((prev) => {
      const netIncome = [...prev.netIncome] as ValuationState["netIncome"];
      netIncome[index] = year;
      return { ...prev, netIncome };
    });
  }

  return (
    <div className="flex w-full max-w-5xl flex-col gap-8 sm:flex-row">
      <div className="flex shrink-0 flex-col gap-6 sm:w-48">
        <Timeline step={step} onJump={setStep} />
        {result.ready && (
          <div className="hidden flex-col gap-1 rounded-xl border border-zinc-200 p-3 sm:flex dark:border-zinc-800">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">현재 1주당 평가액</span>
            <span className="text-base font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
              {formatWon(result.perShare.final)}
            </span>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-8 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8 dark:border-white/10 dark:bg-zinc-950">
        {step === 0 && <BasicInfoStep value={state.basic} onChange={(basic) => setState((prev) => ({ ...prev, basic }))} />}
        {step === 1 && (
          <BalanceSheetStep
            accounts={state.accounts}
            valuationDate={context.valuationDate}
            fiscalYearEndMonth={context.fiscalYearEndMonth}
            onChange={(accounts) => setState((prev) => ({ ...prev, accounts }))}
          />
        )}
        {(step === 2 || step === 3) && (
          <EvaluationStep
            key={step}
            side={step === 2 ? "asset" : "liability"}
            accounts={state.accounts}
            values={values}
            context={context}
            onChange={(accounts) => setState((prev) => ({ ...prev, accounts }))}
          />
        )}
        {step === 4 && (
          <AdjustmentsStep value={state.adjustments} onChange={(adjustments) => setState((prev) => ({ ...prev, adjustments }))} />
        )}
        {step === 5 && (
          <NetIncomeStep
            years={state.netIncome}
            results={result.netIncome.years}
            totalShares={state.basic.totalShares}
            onChange={setNetIncomeYear}
          />
        )}
        {step === 6 && (
          <JudgmentStep value={state.judgment} result={result} onChange={(judgment) => setState((prev) => ({ ...prev, judgment }))} />
        )}
        {isResultStep && <ResultStep state={state} result={result} />}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={goBack} className="btn-secondary">
            이전
          </button>
          {isResultStep ? (
            <button type="button" onClick={reset} className="btn-secondary">
              처음부터 다시
            </button>
          ) : (
            <button type="button" onClick={goNext} className="btn-primary">
              다음단계
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ step, onJump }: { step: number; onJump: (step: number) => void }) {
  return (
    <ol className="flex gap-4 overflow-x-auto sm:flex-col sm:gap-0 sm:overflow-visible">
      {STEPS.map((label, i) => {
        const isDone = i < step;
        const isCurrent = i === step;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={label} className="flex shrink-0 items-center gap-3 sm:items-stretch">
            <div className="flex flex-col items-center">
              <span
                className={
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold " +
                  (isDone
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : isCurrent
                      ? "border-2 border-zinc-900 text-zinc-900 dark:border-zinc-50 dark:text-zinc-50"
                      : "border border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-600")
                }
              >
                {isDone ? "✓" : i + 1}
              </span>
              {!isLast && (
                <span
                  className={
                    "mt-1 hidden w-px flex-1 sm:block " +
                    (isDone ? "bg-zinc-900 dark:bg-zinc-50" : "bg-zinc-200 dark:bg-zinc-800")
                  }
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => onJump(i)}
              aria-current={isCurrent ? "step" : undefined}
              className={
                "self-start text-left text-sm sm:pb-8 " +
                (isCurrent
                  ? "font-semibold text-zinc-900 dark:text-zinc-50"
                  : isDone
                    ? "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                    : "text-zinc-400 hover:text-zinc-700 dark:text-zinc-600 dark:hover:text-zinc-300")
              }
            >
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
