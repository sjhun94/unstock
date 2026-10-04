"use client";

import {
  METHOD_DESCRIPTIONS,
  METHOD_LABELS,
  METHODS_BY_SIDE,
  type Account,
  type AccountValue,
  type Side,
  type ValuationMethod,
} from "@/lib/valuation/index.ts";
import { CorporateTaxEditor, EmployeesEditor, FixedAssetsEditor, UnconfirmedEditor, type EditorContext } from "./editors";
import { Checkbox, MiniField, Note, NumberInput, ResultRow, StepSection, formatWon } from "./ui";

const SIDE_TEXT: Record<Side, { title: string; description: string; empty: string }> = {
  asset: {
    title: "자산 평가",
    description: "재무상태표의 자산을 상증세법상 평가액으로 바꿉니다. 평가 유형별로 필요한 값을 입력하세요.",
    empty: "자산 계정이 없어요. 재무상태표 단계에서 붙여넣어 주세요.",
  },
  liability: {
    title: "부채 평가",
    description: "재무상태표의 부채를 상증세법상 평가액으로 바꿉니다. 평가기준일 현재 지급의무가 확정된 금액만 부채로 인정됩니다.",
    empty: "부채 계정이 없어요. 재무상태표 단계에서 붙여넣어 주세요.",
  },
};

const QUIET: ValuationMethod[] = ["zero", "book"]; // 입력할 것이 없어 접어서 보여주는 유형

export default function EvaluationStep({
  side,
  accounts,
  values,
  context,
  onChange,
}: {
  side: Side;
  accounts: Account[];
  values: Map<string, AccountValue>;
  context: EditorContext;
  onChange: (accounts: Account[]) => void;
}) {
  const sideAccounts = accounts.filter((account) => account.side === side);
  const update = (id: string, patch: Partial<Account>) =>
    onChange(accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)));

  const groups = METHODS_BY_SIDE[side]
    .map((method) => ({ method, rows: sideAccounts.filter((account) => account.method === method) }))
    .filter((group) => group.rows.length > 0);
  const active = groups.filter((group) => !QUIET.includes(group.method));
  const quiet = groups.filter((group) => QUIET.includes(group.method));

  const bookTotal = sideAccounts.reduce((sum, a) => sum + (values.get(a.id)?.book ?? 0), 0);
  const taxTotal = sideAccounts.reduce((sum, a) => sum + (values.get(a.id)?.taxValue ?? 0), 0);

  return (
    <StepSection title={SIDE_TEXT[side].title} description={SIDE_TEXT[side].description}>
      {sideAccounts.length === 0 && <Note>{SIDE_TEXT[side].empty}</Note>}

      {active.map(({ method, rows }) => (
        <section key={method} className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {METHOD_LABELS[method]} <span className="font-normal text-zinc-400">· {rows.length}개</span>
            </h3>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{METHOD_DESCRIPTIONS[method]}</p>
          </div>
          {rows.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              value={values.get(account.id)}
              context={context}
              onChange={(patch) => update(account.id, patch)}
            />
          ))}
        </section>
      ))}

      {quiet.map(({ method, rows }) => (
        <details key={method} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <summary className="cursor-pointer text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            {METHOD_LABELS[method]} <span className="font-normal text-zinc-400">· {rows.length}개</span>
          </summary>
          <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{METHOD_DESCRIPTIONS[method]}</p>
          <div className="mt-3 flex flex-col gap-2">
            {rows.map((account) => {
              const value = values.get(account.id);
              return (
                <div key={account.id} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1fr_9rem_10rem]">
                  <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">{account.name || "(이름 없음)"}</span>
                  <span className="text-right text-xs tabular-nums text-zinc-500">장부 {formatWon(value?.book ?? 0)}</span>
                  {method === "book" ? (
                    <div className="col-span-2 sm:col-span-1">
                      <NumberInput
                        value={account.manualValue}
                        onChange={(manualValue) => update(account.id, { manualValue })}
                        placeholder="평가액 (비우면 장부가액)"
                        ariaLabel={`${account.name} 평가액`}
                      />
                    </div>
                  ) : (
                    <span className="col-span-2 text-right text-sm tabular-nums text-zinc-800 sm:col-span-1 dark:text-zinc-200">0원</span>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      ))}

      {sideAccounts.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl bg-zinc-50 p-4 dark:bg-zinc-900">
          <ResultRow label="재무상태표 금액 합계" value={formatWon(bookTotal)} />
          <ResultRow label="상증세법상 평가액 합계" value={formatWon(taxTotal)} />
          <ResultRow label="평가차액 합계" value={formatWon(taxTotal - bookTotal)} emphasize />
        </div>
      )}
    </StepSection>
  );
}

function AccountCard({
  account,
  value,
  context,
  onChange,
}: {
  account: Account;
  value: AccountValue | undefined;
  context: EditorContext;
  onChange: (patch: Partial<Account>) => void;
}) {
  const field = (label: string, key: keyof Account, placeholder?: string) => (
    <MiniField label={label}>
      <NumberInput value={account[key] as string} onChange={(next) => onChange({ [key]: next })} placeholder={placeholder} />
    </MiniField>
  );

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-zinc-900 dark:text-zinc-50">{account.name || "(이름 없음)"}</span>
        <span className="shrink-0 text-xs tabular-nums text-zinc-500">재무상태표 {formatWon(value?.book ?? 0)}</span>
      </div>

      {account.method === "deposit" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {field("평가기준일까지의 미수이자", "accruedInterest")}
          {field("원천징수세액", "withholdingTax")}
        </div>
      )}

      {account.method === "receivable" && (
        <div className="flex flex-col gap-3">
          {field("회수 불가능한 금액", "uncollectible")}
          <Checkbox checked={account.over5Years} onChange={(over5Years) => onChange({ over5Years })}>
            회수기간이 5년을 넘는 채권입니다
          </Checkbox>
          {account.over5Years && field("현재가치 (적정할인율로 할인한 회수액 합계)", "presentValue")}
        </div>
      )}

      {account.method === "realEstate" && (
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("시가 (매매·감정·수용가액 등)", "marketValue", "없으면 비워두세요")}
            {field("기준시가 (개별공시지가 등)", "standardValue")}
          </div>
          <Checkbox checked={account.justifiedBelowBook} onChange={(justifiedBelowBook) => onChange({ justifiedBelowBook })}>
            장부가액보다 작게 평가할 정당한 사유가 있습니다
          </Checkbox>
        </div>
      )}

      {account.method === "listedStock" && (
        <div className="grid gap-3 sm:grid-cols-2">
          {field("평가기준일 전후 2개월 종가 평균", "avgPrice")}
          {field("보유 주식 수", "shareCount")}
        </div>
      )}

      {account.method === "manual" && field("별도 평가액", "manualValue")}
      {account.method === "inventory" && field("처분 예상가액", "disposalValue", "모르면 비워두세요 (장부가액 적용)")}
      {account.method === "prepaidExpense" && field("평가기준일 현재 비용으로 확정된 금액", "expensedAmount")}
      {account.method === "borrowing" && field("평가기준일까지의 미지급이자", "accruedInterest")}
      {account.method === "provision" && field("평가기준일 현재 확정된 금액", "confirmedAmount")}

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
          {value.note && <p className="text-xs text-zinc-500 dark:text-zinc-400">{value.note}</p>}
          {value.fallbackToBook && (
            <p className="text-xs text-amber-700 dark:text-amber-400">필요한 값이 비어 있어 재무상태표 금액으로 평가했습니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
