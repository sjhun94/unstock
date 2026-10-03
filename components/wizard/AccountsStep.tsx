"use client";

import { useState } from "react";
import {
  ACCOUNT_PRESETS,
  METHOD_LABELS,
  METHODS_BY_SIDE,
  corporateTaxPayable,
  createAccount,
  createEmployee,
  createFixedAsset,
  createTaxCredit,
  createUnconfirmed,
  fixedAssetTaxValue,
  isCorporateTaxEmpty,
  matchPreset,
  parseEmployees,
  parseFixedAssets,
  num,
  severanceEstimate,
  standardRate,
  type Account,
  type AccountValue,
  type CorporateTaxInput,
  type DepreciationMethod,
  type Side,
  type ValuationMethod,
} from "@/lib/valuation/index.ts";
import {
  Checkbox,
  DateInput,
  MiniField,
  Note,
  NumberInput,
  RemoveButton,
  ResultRow,
  SmallButton,
  StepSection,
  TextInput,
  formatWon,
} from "./ui";
import ImportPanel from "./ImportPanel";
import RowPastePanel from "./RowPastePanel";

interface Context {
  valuationDate: string;
  fiscalYearEndMonth: number;
}

const SIDE_TEXT: Record<Side, { title: string; description: string }> = {
  asset: {
    title: "자산 평가",
    description:
      "평가기준일 현재 재무상태표의 자산 계정을 입력하고, 계정마다 상증세법상 평가방법을 고르세요. 회사에 없는 계정은 삭제하고, 필요한 계정은 추가할 수 있어요.",
  },
  liability: {
    title: "부채 평가",
    description:
      "평가기준일 현재 재무상태표의 부채 계정을 입력하세요. 부채는 평가기준일 현재 지급의무가 확정된 금액만 인정됩니다.",
  },
};

function replaceById<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export default function AccountsStep({
  side,
  accounts,
  values,
  context,
  onChange,
}: {
  side: Side;
  accounts: Account[];
  values: Map<string, AccountValue>;
  context: Context;
  onChange: (accounts: Account[]) => void;
}) {
  const presets = ACCOUNT_PRESETS.filter((preset) => preset.side === side);
  const [presetName, setPresetName] = useState(presets[0].name);
  const sideAccounts = accounts.filter((account) => account.side === side);

  const bookTotal = sideAccounts.reduce((sum, account) => sum + (values.get(account.id)?.book ?? 0), 0);
  const taxTotal = sideAccounts.reduce((sum, account) => sum + (values.get(account.id)?.taxValue ?? 0), 0);

  function addAccount() {
    const preset = presets.find((p) => p.name === presetName) ?? presets[0];
    onChange([...accounts, createAccount(side, preset.name, preset.method)]);
  }

  return (
    <StepSection title={SIDE_TEXT[side].title} description={SIDE_TEXT[side].description}>
      <ImportPanel side={side} accounts={accounts} onChange={onChange} />

      {sideAccounts.length === 0 && <Note>입력된 계정이 없습니다. 아래에서 계정을 추가하세요.</Note>}

      {sideAccounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          value={values.get(account.id)}
          context={context}
          onChange={(patch) => onChange(replaceById(accounts, account.id, patch))}
          onRemove={() => onChange(accounts.filter((a) => a.id !== account.id))}
        />
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          aria-label="추가할 계정과목"
          className="input w-auto flex-1"
        >
          {presets.map((preset) => (
            <option key={preset.name} value={preset.name}>
              {preset.name}
            </option>
          ))}
        </select>
        <button type="button" onClick={addAccount} className="btn-secondary">
          계정 추가
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
        <ResultRow label="재무상태표 금액 합계" value={formatWon(bookTotal)} />
        <ResultRow label="상증세법상 평가액 합계" value={formatWon(taxTotal)} />
        <ResultRow label="평가차액 합계" value={formatWon(taxTotal - bookTotal)} emphasize />
      </div>
    </StepSection>
  );
}

function AccountCard({
  account,
  value,
  context,
  onChange,
  onRemove,
}: {
  account: Account;
  value: AccountValue | undefined;
  context: Context;
  onChange: (patch: Partial<Account>) => void;
  onRemove: () => void;
}) {
  const hint = matchPreset(account.name, account.side)?.hint;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-center gap-2">
        <TextInput value={account.name} onChange={(name) => onChange({ name })} placeholder="계정과목명" ariaLabel="계정과목명" />
        <RemoveButton onClick={onRemove} label={`${account.name || "계정"} 삭제`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MiniField label="재무상태표 금액">
          <NumberInput value={account.bookValue} onChange={(bookValue) => onChange({ bookValue })} />
        </MiniField>
        <MiniField label="평가방법">
          <select
            value={account.method}
            onChange={(e) => onChange({ method: e.target.value as ValuationMethod })}
            className="input"
          >
            {METHODS_BY_SIDE[account.side].map((method) => (
              <option key={method} value={method}>
                {METHOD_LABELS[method]}
              </option>
            ))}
          </select>
        </MiniField>
      </div>

      {hint && <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{hint}</p>}

      {account.method === "manual" && (
        <MiniField label="상증세법상 평가액">
          <NumberInput value={account.manualValue} onChange={(manualValue) => onChange({ manualValue })} />
        </MiniField>
      )}

      {account.method === "deposit" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniField label="평가기준일까지의 미수이자">
            <NumberInput value={account.accruedInterest} onChange={(accruedInterest) => onChange({ accruedInterest })} />
          </MiniField>
          <MiniField label="원천징수세율 (%)">
            <NumberInput
              value={account.withholdingRatePercent}
              onChange={(withholdingRatePercent) => onChange({ withholdingRatePercent })}
            />
          </MiniField>
        </div>
      )}

      {account.method === "depreciation" && <FixedAssetsEditor account={account} context={context} onChange={onChange} />}
      {account.method === "unconfirmed" && <UnconfirmedEditor account={account} onChange={onChange} />}
      {account.method === "corporateTax" && (
        <CorporateTaxEditor value={account.corporateTax} onChange={(corporateTax) => onChange({ corporateTax })} />
      )}
      {account.method === "severance" && <EmployeesEditor account={account} context={context} onChange={onChange} />}

      {value && (
        <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <ResultRow label="상증세법상 평가액" value={formatWon(value.taxValue)} />
          <ResultRow label="평가차액" value={formatWon(value.diff)} />
          {value.fallbackToBook && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              명세가 입력되지 않아 재무상태표 금액으로 평가했습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FixedAssetsEditor({
  account,
  context,
  onChange,
}: {
  account: Account;
  context: Context;
  onChange: (patch: Partial<Account>) => void;
}) {
  const rows = account.fixedAssets;
  return (
    <div className="flex flex-col gap-3">
      <RowPastePanel
        title="엑셀에서 자산 명세 붙여넣기"
        description="감가상각 명세(감가조서)에서 자산명·취득일·취득가액 열을, 있으면 내용연수·상각방법(정률/정액)·상각률 열도 함께 복사해 붙여넣으세요. 내용연수가 없으면 5년으로 넣어요."
        placeholder={"노트북\t2023-01-15\t1,000,000\t5\t정률법\n..."}
        parse={parseFixedAssets}
        hasExisting={rows.length > 0}
        columns={[
          { label: "자산명", render: (r) => r.name || "-" },
          { label: "취득일", render: (r) => r.acquisitionDate },
          { label: "취득가액", render: (r) => formatWon(num(r.cost)), align: "right" },
          { label: "내용연수", render: (r) => `${r.usefulLifeYears}년`, align: "right" },
          { label: "상각방법", render: (r) => (r.method === "straight" ? "정액법" : "정률법") },
        ]}
        onApply={(imported, mode) => onChange({ fixedAssets: mode === "replace" ? imported : [...rows, ...imported] })}
      />
      {rows.map((asset) => {
        const computed = fixedAssetTaxValue(asset, context.valuationDate, context.fiscalYearEndMonth);
        const standard = standardRate(asset.method, num(asset.usefulLifeYears));
        const update = (patch: Partial<typeof asset>) => onChange({ fixedAssets: replaceById(rows, asset.id, patch) });
        return (
          <div key={asset.id} className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <div className="flex items-end gap-2">
              <MiniField label="자산명" className="flex-1">
                <TextInput value={asset.name} onChange={(name) => update({ name })} placeholder="예: 노트북" />
              </MiniField>
              <RemoveButton
                onClick={() => onChange({ fixedAssets: rows.filter((r) => r.id !== asset.id) })}
                label="자산 삭제"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <MiniField label="취득일">
                <DateInput value={asset.acquisitionDate} onChange={(acquisitionDate) => update({ acquisitionDate })} />
              </MiniField>
              <MiniField label="취득가액">
                <NumberInput value={asset.cost} onChange={(cost) => update({ cost })} />
              </MiniField>
              <MiniField label="내용연수(년)">
                <NumberInput value={asset.usefulLifeYears} onChange={(usefulLifeYears) => update({ usefulLifeYears })} />
              </MiniField>
              <MiniField label="상각방법">
                <select
                  value={asset.method}
                  onChange={(e) => update({ method: e.target.value as DepreciationMethod })}
                  className="input"
                >
                  <option value="declining">정률법</option>
                  <option value="straight">정액법</option>
                </select>
              </MiniField>
              <MiniField label="상각률">
                <NumberInput
                  value={asset.rate}
                  onChange={(rate) => update({ rate })}
                  placeholder={standard ? String(Number(standard.toFixed(3))) : "직접 입력"}
                />
              </MiniField>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              {computed.valid
                ? `세무상 장부가액 ${formatWon(computed.taxBookValue)} (상각누계액 ${formatWon(computed.cost - computed.taxBookValue)})`
                : "취득일·취득가액·내용연수를 입력하면 세무상 장부가액이 계산됩니다."}
            </p>
          </div>
        );
      })}
      <SmallButton onClick={() => onChange({ fixedAssets: [...rows, createFixedAsset()] })}>자산 추가</SmallButton>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        취득월부터 평가기준일이 속하는 달까지 사업연도별로 월할 상각하고, 내용연수가 끝나면 1,000원만 남깁니다. 상각률을
        비워두면 내용연수별 표준 상각률을 적용합니다.
      </p>
    </div>
  );
}

function UnconfirmedEditor({ account, onChange }: { account: Account; onChange: (patch: Partial<Account>) => void }) {
  const rows = account.unconfirmed;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => (
        <div key={row.id} className="flex items-end gap-2">
          <MiniField label="확정되지 않은 부채 내용" className="flex-1">
            <TextInput
              value={row.name}
              onChange={(name) => onChange({ unconfirmed: replaceById(rows, row.id, { name }) })}
              placeholder="예: 연차충당부채"
            />
          </MiniField>
          <MiniField label="금액" className="w-40">
            <NumberInput value={row.amount} onChange={(amount) => onChange({ unconfirmed: replaceById(rows, row.id, { amount }) })} />
          </MiniField>
          <RemoveButton onClick={() => onChange({ unconfirmed: rows.filter((r) => r.id !== row.id) })} label="항목 삭제" />
        </div>
      ))}
      <SmallButton onClick={() => onChange({ unconfirmed: [...rows, createUnconfirmed()] })}>미확정 부채 추가</SmallButton>
    </div>
  );
}

const TAX_FIELDS: { key: Exclude<keyof CorporateTaxInput, "credits">; label: string }[] = [
  { key: "computedTax", label: "산출세액 (법인세)" },
  { key: "minimumTax", label: "최저한세" },
  { key: "penaltyTax", label: "가산세액" },
  { key: "interimPrepaid", label: "중간예납세액" },
  { key: "withheld", label: "원천납부세액" },
  { key: "additionalPayment", label: "감면분 추가납부세액" },
  { key: "landTransferTax", label: "토지 등 양도소득에 대한 법인세" },
  { key: "unappropriatedIncomeTax", label: "미환류소득에 대한 법인세" },
  { key: "localComputedTax", label: "산출세액 (지방소득세분)" },
  { key: "localPenaltyTax", label: "가산세 (지방소득세분)" },
  { key: "localWithheld", label: "원천납부세액 (지방소득세분)" },
];

function CorporateTaxEditor({ value, onChange }: { value: CorporateTaxInput; onChange: (value: CorporateTaxInput) => void }) {
  const credits = value.credits;
  const result = isCorporateTaxEmpty(value) ? null : corporateTaxPayable(value);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        {TAX_FIELDS.map(({ key, label }) => (
          <MiniField key={key} label={label}>
            <NumberInput value={value[key]} onChange={(next) => onChange({ ...value, [key]: next })} />
          </MiniField>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">세액공제·감면</span>
        {credits.map((credit) => {
          const update = (patch: Partial<typeof credit>) => onChange({ ...value, credits: replaceById(credits, credit.id, patch) });
          return (
            <div key={credit.id} className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
              <div className="flex items-end gap-2">
                <MiniField label="공제·감면 이름" className="flex-1">
                  <TextInput value={credit.name} onChange={(name) => update({ name })} placeholder="예: 통합고용세액공제" />
                </MiniField>
                <RemoveButton
                  onClick={() => onChange({ ...value, credits: credits.filter((c) => c.id !== credit.id) })}
                  label="공제 삭제"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <MiniField label="공제대상금액">
                  <NumberInput value={credit.amount} onChange={(amount) => update({ amount })} />
                </MiniField>
                <MiniField label="공제·감면 배제액">
                  <NumberInput value={credit.excluded} onChange={(excluded) => update({ excluded })} />
                </MiniField>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                <Checkbox checked={credit.minimumTaxApplies} onChange={(minimumTaxApplies) => update({ minimumTaxApplies })}>
                  최저한세 적용대상
                </Checkbox>
                <Checkbox checked={credit.ruralTaxApplies} onChange={(ruralTaxApplies) => update({ ruralTaxApplies })}>
                  농어촌특별세 적용대상
                </Checkbox>
              </div>
            </div>
          );
        })}
        <SmallButton onClick={() => onChange({ ...value, credits: [...credits, createTaxCredit()] })}>공제·감면 추가</SmallButton>
      </div>

      {result && (
        <div className="flex flex-col gap-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
          <ResultRow label="법인세 차감납부할세액" value={formatWon(result.nationalPayable)} />
          <ResultRow label="법인지방소득세" value={formatWon(result.localPayable)} />
          <ResultRow label="미환류소득 법인세·지방소득세" value={formatWon(result.unappropriatedTotal)} />
          <ResultRow label="농어촌특별세" value={formatWon(result.ruralTax)} />
          <ResultRow label="납부할 세액 합계" value={formatWon(result.totalPayable)} emphasize />
        </div>
      )}
    </div>
  );
}

function EmployeesEditor({
  account,
  context,
  onChange,
}: {
  account: Account;
  context: Context;
  onChange: (patch: Partial<Account>) => void;
}) {
  const rows = account.employees;
  return (
    <div className="flex flex-col gap-3">
      <RowPastePanel
        title="엑셀에서 직원 명세 붙여넣기"
        description="직원별로 이름(또는 구분)·입사일·급여 열을 복사해 붙여넣으세요. 금액이 1개면 월평균급여, 2개면 월급여와 연간상여, 3개면 최근 3개월 급여, 4개면 3개월 급여와 연간상여로 읽어요."
        placeholder={"직원A\t2020-09-30\t3,000,000\t3,000,000\t3,000,000\t6,000,000\n..."}
        parse={parseEmployees}
        hasExisting={rows.length > 0}
        columns={[
          { label: "구분", render: (r) => r.name || "-" },
          { label: "입사일", render: (r) => r.hireDate },
          {
            label: "월평균급여",
            render: (r) => formatWon((num(r.wage1) + num(r.wage2) + num(r.wage3)) / 3),
            align: "right",
          },
          { label: "연간상여", render: (r) => formatWon(num(r.annualBonus)), align: "right" },
          { label: "추계액", render: (r) => formatWon(severanceEstimate(r, context.valuationDate)), align: "right" },
        ]}
        onApply={(imported, mode) => onChange({ employees: mode === "replace" ? imported : [...rows, ...imported] })}
      />
      {rows.map((employee, index) => {
        const update = (patch: Partial<typeof employee>) => onChange({ employees: replaceById(rows, employee.id, patch) });
        return (
          <div key={employee.id} className="flex flex-col gap-2 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900">
            <div className="flex items-end gap-2">
              <MiniField label="구분" className="flex-1">
                <TextInput value={employee.name} onChange={(name) => update({ name })} placeholder={`직원 ${index + 1}`} />
              </MiniField>
              <MiniField label="입사일" className="w-36">
                <DateInput value={employee.hireDate} onChange={(hireDate) => update({ hireDate })} />
              </MiniField>
              <RemoveButton onClick={() => onChange({ employees: rows.filter((r) => r.id !== employee.id) })} label="직원 삭제" />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <MiniField label="최근 3개월 급여 ①">
                <NumberInput value={employee.wage1} onChange={(wage1) => update({ wage1 })} />
              </MiniField>
              <MiniField label="최근 3개월 급여 ②">
                <NumberInput value={employee.wage2} onChange={(wage2) => update({ wage2 })} />
              </MiniField>
              <MiniField label="최근 3개월 급여 ③">
                <NumberInput value={employee.wage3} onChange={(wage3) => update({ wage3 })} />
              </MiniField>
              <MiniField label="연간 상여금">
                <NumberInput value={employee.annualBonus} onChange={(annualBonus) => update({ annualBonus })} />
              </MiniField>
            </div>
            <p className="text-xs text-zinc-600 dark:text-zinc-300">
              퇴직급여 추계액 {formatWon(severanceEstimate(employee, context.valuationDate))}
            </p>
          </div>
        );
      })}
      <SmallButton onClick={() => onChange({ employees: [...rows, createEmployee()] })}>직원 추가</SmallButton>
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        (최근 3개월 평균급여 + 연간 상여금 ÷ 12) × 근속연수(입사일~평가기준일)로 계산합니다. 확정급여형(DB)·퇴직금제도
        대상자만 입력하세요.
      </p>
    </div>
  );
}
