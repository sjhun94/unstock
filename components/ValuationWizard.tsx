"use client";

import { useState } from "react";
import { calculateValuation, type ValuationInput } from "@/lib/valuation";
import ExpertContactCTA from "@/components/ExpertContactCTA";
import NetProfitUpload from "@/components/NetProfitUpload";
import NetAssetUpload, { type NetAssetResult } from "@/components/NetAssetUpload";

const STEPS = ["로직 설명", "기본정보", "순자산가치", "순손익가치", "기타사항", "결과"] as const;

const initialForm = {
  companyName: "",
  parValue: "",
  totalShares: "",
  businessStartDate: "",
  valuationDate: "",
  financialStatementDate: "",
  netAssetInputMode: "adjusted" as "adjusted" | "bookPlusReserve",
  totalAssets: "",
  totalLiabilities: "",
  bookAssets: "",
  bookLiabilities: "",
  reserveAddition: "0",
  reserveSubtraction: "0",
  purchasedGoodwillDeduction: "0",
  isRealEstateHeavy: false,
  profitYear1: "",
  profitYear2: "",
  profitYear3: "",
  capitalizationRatePercent: "10",
  isMajorShareholder: false,
  majorShareholderRatio: "",
  isSmallBusiness: true,
};

type FormState = typeof initialForm;

const won = new Intl.NumberFormat("ko-KR");

function formatWon(value: number) {
  if (!Number.isFinite(value)) return "-";
  return `${won.format(Math.round(value))}원`;
}

function toNumber(value: string) {
  const n = Number(value.replaceAll(",", ""));
  return Number.isFinite(n) ? n : 0;
}

// 입력값을 숫자만 남긴 뒤 YYYY-MM-DD 형태로 자동 하이픈을 넣어줍니다.
// 네이티브 <input type="date">가 브라우저/OS 로케일에 따라 형식이 제각각으로 보이는 문제를 피하기 위해 직접 구현합니다.
function formatDateInput(raw: string) {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 4) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

export default function ValuationWizard({ onExitToLanding }: { onExitToLanding?: () => void }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initialForm);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const isResultStep = step === STEPS.length - 1;

  function canProceed() {
    if (step === 1) {
      return toNumber(form.totalShares) > 0 && form.businessStartDate !== "" && form.valuationDate !== "";
    }
    if (step === 2) {
      return form.netAssetInputMode === "adjusted"
        ? form.totalAssets !== "" && form.totalLiabilities !== ""
        : form.bookAssets !== "" && form.bookLiabilities !== "";
    }
    if (step === 3) {
      return form.capitalizationRatePercent !== "" && toNumber(form.capitalizationRatePercent) > 0;
    }
    return true;
  }

  function goNext() {
    if (!canProceed()) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    if (step === 0) {
      onExitToLanding?.();
      return;
    }
    setStep((s) => Math.max(s - 1, 0));
  }

  function reset() {
    setForm(initialForm);
    setStep(0);
  }

  function handleNetAssetResult(result: NetAssetResult) {
    setForm((prev) => ({
      ...prev,
      bookAssets: String(result.bookAssets),
      bookLiabilities: String(result.bookLiabilities),
      reserveAddition: String(result.reserveAddition),
      reserveSubtraction: String(result.reserveSubtraction),
    }));
  }

  const taxAdjustedAssets =
    form.netAssetInputMode === "adjusted"
      ? toNumber(form.totalAssets)
      : toNumber(form.bookAssets) + toNumber(form.reserveAddition) - toNumber(form.reserveSubtraction);
  const taxAdjustedLiabilities =
    form.netAssetInputMode === "adjusted" ? toNumber(form.totalLiabilities) : toNumber(form.bookLiabilities);

  const input: ValuationInput = {
    totalShares: toNumber(form.totalShares),
    totalAssets: taxAdjustedAssets,
    totalLiabilities: taxAdjustedLiabilities,
    purchasedGoodwillDeduction: toNumber(form.purchasedGoodwillDeduction),
    isRealEstateHeavy: form.isRealEstateHeavy,
    profitYear1: toNumber(form.profitYear1),
    profitYear2: toNumber(form.profitYear2),
    profitYear3: toNumber(form.profitYear3),
    capitalizationRate: toNumber(form.capitalizationRatePercent) / 100,
    businessStartDate: form.businessStartDate,
    valuationDate: form.valuationDate,
    isMajorShareholder: form.isMajorShareholder,
    majorShareholderRatio: toNumber(form.majorShareholderRatio),
    isSmallBusiness: form.isSmallBusiness,
  };

  const result =
    isResultStep && input.totalShares > 0 && input.capitalizationRate > 0 ? calculateValuation(input) : null;

  return (
    <div className="flex w-full max-w-4xl flex-col gap-8 sm:flex-row">
      <Timeline step={step} />

      <div className="flex flex-1 flex-col gap-8 rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-950">
      {step === 0 && (
        <StepSection
          title="세법상 비상장주식 평가, 이렇게 계산돼요"
          description="본격적인 입력에 앞서, 계산 방식을 간단히 설명드릴게요."
        >
          <ol className="flex flex-col gap-3 text-sm text-zinc-600 dark:text-zinc-300">
            <li>
              <b className="text-zinc-900 dark:text-zinc-50">1. 순손익가치와 순자산가치를 각각 계산해요.</b>
              <br />
              최근 3개년 손익을 가중평균한 값으로 순손익가치를, 자산에서 부채를 뺀 값으로 순자산가치를 구해요.
            </li>
            <li>
              <b className="text-zinc-900 dark:text-zinc-50">2. 두 가치를 3:2로 가중평균해요.</b>
              <br />
              (순손익가치 × 3 + 순자산가치 × 2) ÷ 5. 부동산 등 자산이 50% 이상인 법인은 2:3으로 계산해요.
            </li>
            <li>
              <b className="text-zinc-900 dark:text-zinc-50">3. 순자산가치의 80%보다 낮으면 80%로 올려요.</b>
              <br />
              가중평균액이 순자산가치의 80%에 미달하면, 순자산가치의 80%를 하한으로 적용해요.
            </li>
            <li>
              <b className="text-zinc-900 dark:text-zinc-50">4. 설립 3년 미만이면 순자산가치만 사용해요.</b>
              <br />
              사업개시일로부터 평가기준일까지 3년이 안 됐다면, 손익 실적을 신뢰하기 어려워 순자산가치로만 평가해요.
            </li>
            <li>
              <b className="text-zinc-900 dark:text-zinc-50">5. 최대주주라면 20%를 더해요.</b>
              <br />
              중소기업이 아닌 법인의 최대주주 및 특수관계인 지분은 평가액의 20%를 가산해요 (중소기업은 면제).
            </li>
          </ol>
        </StepSection>
      )}

      {step === 1 && (
        <StepSection title="기본정보" description="평가 대상 회사의 기본 정보를 입력하세요.">
          <Field label="법인명 (선택)">
            <input
              type="text"
              value={form.companyName}
              onChange={(e) => update("companyName", e.target.value)}
              placeholder="예: (주)예시"
              className="input"
            />
          </Field>
          <Field label="1주당 액면가액 (선택)">
            <input
              type="number"
              inputMode="numeric"
              value={form.parValue}
              onChange={(e) => update("parValue", e.target.value)}
              placeholder="예: 5000"
              className="input"
            />
          </Field>
          <Field label="발행주식총수" required>
            <input
              type="number"
              inputMode="numeric"
              value={form.totalShares}
              onChange={(e) => update("totalShares", e.target.value)}
              placeholder="예: 10000"
              className="input"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              발행한 주식수가 없다면 1로 입력해 주세요.
            </p>
          </Field>
          <Field label="자본금 (자동계산)">
            <p className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              {formatWon(toNumber(form.parValue) * toNumber(form.totalShares))}
              <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">(액면가액 × 발행주식총수)</span>
            </p>
          </Field>
          <Field label="사업개시일" required>
            <input
              type="text"
              inputMode="numeric"
              value={form.businessStartDate}
              onChange={(e) => update("businessStartDate", formatDateInput(e.target.value))}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              className="input"
            />
          </Field>
          <Field label="평가기준일" required>
            <input
              type="text"
              inputMode="numeric"
              value={form.valuationDate}
              onChange={(e) => update("valuationDate", formatDateInput(e.target.value))}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              className="input"
            />
          </Field>
          <Field label="재무제표기준일 (선택)">
            <input
              type="text"
              inputMode="numeric"
              value={form.financialStatementDate}
              onChange={(e) => update("financialStatementDate", formatDateInput(e.target.value))}
              placeholder="YYYY-MM-DD"
              maxLength={10}
              className="input"
            />
          </Field>
        </StepSection>
      )}

      {step === 2 && (
        <StepSection title="순자산가치" description="평가기준일 현재 세법상 자산·부채 총액을 입력하세요.">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              자산·부채 금액을 어떻게 입력하시겠어요?
            </span>
            <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="radio"
                name="netAssetInputMode"
                checked={form.netAssetInputMode === "adjusted"}
                onChange={() => update("netAssetInputMode", "adjusted")}
                className="mt-1 h-4 w-4"
              />
              <span>
                세무조정이 이미 반영된 <b>세법상 자산·부채금액</b>을 알고 있어요
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input
                type="radio"
                name="netAssetInputMode"
                checked={form.netAssetInputMode === "bookPlusReserve"}
                onChange={() => update("netAssetInputMode", "bookPlusReserve")}
                className="mt-1 h-4 w-4"
              />
              <span>
                <b>재무상태표상 자산·부채</b>와 <b>유보·△유보</b>로 직접 계산할게요
              </span>
            </label>
          </div>

          {form.netAssetInputMode === "adjusted" ? (
            <>
              <Field label="세법상 자산총액" required>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.totalAssets}
                  onChange={(e) => update("totalAssets", e.target.value)}
                  placeholder="예: 1500000000"
                  className="input"
                />
              </Field>
              <Field label="세법상 부채총액" required>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.totalLiabilities}
                  onChange={(e) => update("totalLiabilities", e.target.value)}
                  placeholder="예: 500000000"
                  className="input"
                />
              </Field>
            </>
          ) : (
            <>
              <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                AI 자동계산은 실험적 기능이에요. 문서에서 확인되는 유보·△유보 항목만 반영하므로, 계산된 값은
                반드시 확인 후 필요하면 직접 수정하세요.
              </p>
              <NetAssetUpload onResult={handleNetAssetResult} />

              <Field label="재무상태표상 자산총액" required>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.bookAssets}
                  onChange={(e) => update("bookAssets", e.target.value)}
                  placeholder="예: 1450000000"
                  className="input"
                />
              </Field>
              <Field label="재무상태표상 부채총액" required>
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.bookLiabilities}
                  onChange={(e) => update("bookLiabilities", e.target.value)}
                  placeholder="예: 500000000"
                  className="input"
                />
              </Field>
              <Field label="유보 합계 (선택)">
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.reserveAddition}
                  onChange={(e) => update("reserveAddition", e.target.value)}
                  placeholder="0"
                  className="input"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  자본금과 적립금조정명세서(을)상 유보 잔액 합계. 자산총액에 더해집니다.
                </p>
              </Field>
              <Field label="△유보(부인유보) 합계 (선택)">
                <input
                  type="number"
                  inputMode="numeric"
                  value={form.reserveSubtraction}
                  onChange={(e) => update("reserveSubtraction", e.target.value)}
                  placeholder="0"
                  className="input"
                />
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  △유보(부인유보) 잔액 합계. 자산총액에서 차감됩니다.
                </p>
              </Field>
              <p className="rounded-lg bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                계산된 세법상 자산총액: <b>{formatWon(taxAdjustedAssets)}</b>
                <br />
                (재무상태표상 자산총액 + 유보 − △유보)
              </p>
            </>
          )}

          <p className="rounded-lg bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
            영업권 상당액은 순손익액·순자산가액을 바탕으로 시행령 제59조 제2항 산식에 따라 자동으로
            계산되어 순자산가치에 반영됩니다 (결과 화면에서 확인 가능). 사업개시 후 3년 미만 법인은
            영업권을 반영하지 않습니다.
          </p>
          <Field label="매입한 영업권 등 차감액 (선택)">
            <input
              type="number"
              inputMode="numeric"
              value={form.purchasedGoodwillDeduction}
              onChange={(e) => update("purchasedGoodwillDeduction", e.target.value)}
              placeholder="0"
              className="input"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              이미 유상으로 취득해 자산에 계상된 영업권(무체재산권)이 있다면 입력하세요. 없으면 0으로 두세요.
            </p>
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.isRealEstateHeavy}
              onChange={(e) => update("isRealEstateHeavy", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            부동산 등 자산 비율이 50% 이상인 법인입니다 (순손익 2 : 순자산 3 가중평균 적용)
          </label>
        </StepSection>
      )}

      {step === 3 && (
        <StepSection
          title="순손익가치"
          description="최근 3개 사업연도의 순손익액(세무조정 후 총액)을 입력하세요. 손익계산서·세무조정계산서가 있다면 AI가 자동으로 계산해드려요."
        >
          <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950 dark:text-amber-300">
            AI 자동계산은 실험적 기능이에요. 핵심 항목(각사업연도소득, 법인세 등)만 반영하며 기부금·이월결손금 등
            세부 조정은 정확하지 않을 수 있어요. 계산된 값은 반드시 확인 후 필요하면 직접 수정하세요.
          </p>

          <Field label="최근 사업연도 (1년 전) 순손익액">
            <input
              type="number"
              inputMode="numeric"
              value={form.profitYear1}
              onChange={(e) => update("profitYear1", e.target.value)}
              placeholder="예: 100000000"
              className="input"
            />
          </Field>
          <NetProfitUpload yearLabel="1년 전" onResult={(value) => update("profitYear1", String(value))} />

          <Field label="2년 전 순손익액">
            <input
              type="number"
              inputMode="numeric"
              value={form.profitYear2}
              onChange={(e) => update("profitYear2", e.target.value)}
              placeholder="예: 80000000"
              className="input"
            />
          </Field>
          <NetProfitUpload yearLabel="2년 전" onResult={(value) => update("profitYear2", String(value))} />

          <Field label="3년 전 순손익액">
            <input
              type="number"
              inputMode="numeric"
              value={form.profitYear3}
              onChange={(e) => update("profitYear3", e.target.value)}
              placeholder="예: 60000000"
              className="input"
            />
          </Field>
          <NetProfitUpload yearLabel="3년 전" onResult={(value) => update("profitYear3", String(value))} />

          <Field label="순손익가치환원율 (%)" required>
            <input
              type="number"
              inputMode="decimal"
              value={form.capitalizationRatePercent}
              onChange={(e) => update("capitalizationRatePercent", e.target.value)}
              placeholder="10"
              className="input"
            />
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              기획재정부 고시 이자율 기준 기본값은 10%입니다.
            </p>
          </Field>
        </StepSection>
      )}

      {step === 4 && (
        <StepSection title="기타사항" description="할증평가 적용 여부를 확인하기 위한 정보를 입력하세요.">
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.isMajorShareholder}
              onChange={(e) => update("isMajorShareholder", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            평가 대상 주주가 최대주주 등에 해당합니다
          </label>
          <Field label="최대주주 등 지분율 (%, 참고용)">
            <input
              type="number"
              inputMode="decimal"
              value={form.majorShareholderRatio}
              onChange={(e) => update("majorShareholderRatio", e.target.value)}
              placeholder="예: 60"
              className="input"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={form.isSmallBusiness}
              onChange={(e) => update("isSmallBusiness", e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300"
            />
            중소기업(또는 할증평가 면제 대상 중견기업)에 해당합니다
          </label>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            최대주주 등에 해당하고 중소기업이 아니라면, 평가액에 20%를 가산하는 할증평가가 적용됩니다.
          </p>
        </StepSection>
      )}

      {isResultStep && result && (
        <StepSection
          title="평가 결과"
          description={
            form.companyName ? `${form.companyName}의 비상장주식 평가 결과입니다.` : "비상장주식 평가 결과입니다."
          }
        >
          {result.isUnder3YearsSinceStart && (
            <p className="rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              사업개시일로부터 평가기준일까지 3년이 되지 않아, 순손익가치를 사용하지 않고 순자산가치만으로
              평가했습니다.
            </p>
          )}

          <div className="flex flex-col gap-3 rounded-xl bg-zinc-50 p-5 dark:bg-zinc-900">
            <ResultRow label="1주당 순손익가치" value={formatWon(result.netProfitValuePerShare)} />
            <ResultRow label="계산된 영업권 (총액)" value={formatWon(result.computedGoodwill)} />
            <ResultRow label="1주당 순자산가치 (영업권 포함)" value={formatWon(result.netAssetValuePerShare)} />
            <ResultRow
              label={
                result.isUnder3YearsSinceStart
                  ? "적용 가액 (순자산가치 단독)"
                  : `가중평균 1주당 가액 (${form.isRealEstateHeavy ? "2:3" : "3:2"})`
              }
              value={formatWon(result.weightedValuePerShare)}
            />
            <div className="my-1 h-px bg-zinc-200 dark:bg-zinc-800" />
            <ResultRow
              label="최대주주 등 할증평가"
              value={result.premiumApplied ? "20% 가산 적용" : "미적용"}
            />
            <ResultRow label="최종 1주당 평가액" value={formatWon(result.finalValuePerShare)} emphasize />
            <ResultRow label="총 평가액" value={formatWon(result.totalCompanyValue)} emphasize />
          </div>

          {result.isThreeYearDeficit && form.isMajorShareholder && !form.isSmallBusiness && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              최근 3개년 연속 결손(순손익액이 모두 음수)이 확인되어, 최대주주 할증평가가 면제되었습니다.
            </p>
          )}

          {result.netAssetFloorApplied && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              가중평균액이 순자산가치의 80%에 미달하여, 순자산가치의 80%를 하한으로 적용했습니다.
            </p>
          )}

          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            본 계산 결과는 상속세 및 증여세법 시행령 제54조의 보충적 평가방법을 단순화하여 산출한 참고용
            수치이며, 세무조정 등 세부 요건을 완전히 반영하지 않았습니다. 실제 신고·의사결정 전에는 반드시
            세무 전문가의 검토를 받으시기 바랍니다.
          </p>

          <ExpertContactCTA />
        </StepSection>
      )}

      <div className="flex items-center justify-between pt-2">
        {isResultStep ? (
          <button onClick={reset} className="btn-secondary">
            처음부터 다시
          </button>
        ) : (
          <button onClick={goBack} className="btn-secondary">
            이전
          </button>
        )}

        {!isResultStep && (
          <button onClick={goNext} disabled={!canProceed()} className="btn-primary disabled:opacity-40">
            다음단계
          </button>
        )}
      </div>
      </div>
    </div>
  );
}

function Timeline({ step }: { step: number }) {
  return (
    <ol className="flex shrink-0 gap-4 overflow-x-auto sm:w-48 sm:flex-col sm:gap-0 sm:overflow-visible">
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
            <span
              className={
                "text-sm sm:pb-8 " +
                (isCurrent
                  ? "font-semibold text-zinc-900 dark:text-zinc-50"
                  : isDone
                    ? "text-zinc-600 dark:text-zinc-400"
                    : "text-zinc-400 dark:text-zinc-600")
              }
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function StepSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}

function ResultRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={emphasize ? "font-semibold text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400"}>
        {label}
      </span>
      <span className={emphasize ? "text-lg font-bold text-zinc-900 dark:text-zinc-50" : "font-medium text-zinc-800 dark:text-zinc-200"}>
        {value}
      </span>
    </div>
  );
}
