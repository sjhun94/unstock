"use client";

import {
  METHOD_DESCRIPTIONS,
  METHOD_LABELS,
  METHODS_BY_SIDE,
  depositInterest,
  interestWithholding,
  isDemandDeposit,
  num,
  type Account,
  type AccountValue,
  type Side,
  type ValuationMethod,
} from "@/lib/valuation/index.ts";
import { CorporateTaxEditor, EmployeesEditor, FixedAssetsEditor, UnconfirmedEditor, type EditorContext } from "./editors";
import HousingPriceLookup from "./HousingPriceLookup";
import LandPriceLookup from "./LandPriceLookup";
import { Checkbox, DateInput, MiniField, Note, NumberInput, ResultRow, StepSection, formatWon } from "./ui";

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
          {method === "deposit" && <DepositNotes accounts={accounts} />}
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

function DepositNotes({ accounts }: { accounts: Account[] }) {
  const accrued = accounts.some((a) => a.side === "asset" && /미수수익|미수이자/.test(a.name.replace(/\s/g, "")));
  return (
    <div className="flex flex-col gap-2">
      {accrued && (
        <Note tone="warning">
          재무상태표에 미수수익이 있어요. 결산 때 미수이자를 이미 잡아 둔 것일 수 있으니, 그렇다면 아래 예금에서 미수이자를 또
          더하지 마세요(이중 계산).
        </Note>
      )}
      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        어느 계좌에서 이자를 받았는지는 법인세 신고서의 &apos;원천납부세액명세서&apos;에서 확인할 수 있어요. 금액이 큰 예금만
        챙기면 충분해요.
      </p>
    </div>
  );
}

function DepositEditor({
  account,
  book,
  context,
  onChange,
}: {
  account: Account;
  book: number;
  context: EditorContext;
  onChange: (patch: Partial<Account>) => void;
}) {
  const result = depositInterest(account, book, context.valuationDate);
  const demand = isDemandDeposit(account.name);

  return (
    <div className="flex flex-col gap-3">
      {account.interestManual ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniField label="평가기준일까지의 미수이자">
            <NumberInput value={account.accruedInterest} onChange={(accruedInterest) => onChange({ accruedInterest })} />
          </MiniField>
          <MiniField label="원천징수세액">
            <NumberInput
              value={account.withholdingTax}
              onChange={(withholdingTax) => onChange({ withholdingTax })}
              placeholder={`비우면 15.4% (${formatWon(interestWithholding(num(account.accruedInterest)))})`}
            />
          </MiniField>
        </div>
      ) : (
        <>
          {demand && !account.interestRatePercent && !account.interestFrom && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              수시로 넣고 빼는 예금은 이자가 아주 적어 미수이자를 0원으로 봐요. 이자가 큰 계좌라면 아래에 입력하세요.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniField label="연이율 (%)">
              <NumberInput
                value={account.interestRatePercent}
                onChange={(interestRatePercent) => onChange({ interestRatePercent })}
                placeholder="예: 3.5"
              />
            </MiniField>
            <MiniField label="가입일 (또는 마지막으로 이자 받은 날)">
              <DateInput value={account.interestFrom} onChange={(interestFrom) => onChange({ interestFrom })} />
            </MiniField>
          </div>
          {result.mode === "computed" && (
            <p className="text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
              미수이자 {formatWon(result.interest)} ({result.days}일분) · 원천징수 {formatWon(result.withholding)} (15.4%)
            </p>
          )}
          {account.interestRatePercent && account.interestFrom && !context.valuationDate && (
            <p className="text-xs text-amber-700 dark:text-amber-400">기본정보에 평가기준일을 넣으면 미수이자를 계산해요.</p>
          )}
        </>
      )}
      <Checkbox checked={account.interestManual} onChange={(interestManual) => onChange({ interestManual })}>
        미수이자를 직접 입력할게요
      </Checkbox>
    </div>
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
        <DepositEditor account={account} book={value?.book ?? 0} context={context} onChange={onChange} />
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
          {/토지|대지|임야|전답/.test(account.name) ? (
            <LandPriceLookup
              valuationDate={context.valuationDate}
              onApply={(value, mode) =>
                onChange({ standardValue: String(mode === "add" ? num(account.standardValue) + value : value) })
              }
            />
          ) : (
            <HousingPriceLookup
              valuationDate={context.valuationDate}
              onApply={(value, mode) =>
                onChange({ standardValue: String(mode === "add" ? num(account.standardValue) + value : value) })
              }
            />
          )}
          <Checkbox checked={account.justifiedBelowBook} onChange={(justifiedBelowBook) => onChange({ justifiedBelowBook })}>
            장부가액보다 작게 평가할 정당한 사유가 있습니다
          </Checkbox>
        </div>
      )}

      {account.method === "listedStock" && (
        <div className="flex flex-col gap-2">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("평가기준일 전후 2개월 종가 평균", "avgPrice")}
            {field("보유 주식 수", "shareCount")}
          </div>
          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
            평가기준일 이전 2개월과 이후 2개월, 모두 4개월간 매일의 종가를 평균한 금액이에요(상증세법 제63조).{" "}
            <a href="https://data.krx.co.kr" target="_blank" rel="noreferrer" className="underline">
              KRX 정보데이터시스템
            </a>
            의 &apos;개별종목 시세 추이&apos;에서 기간을 지정해 종가를 확인할 수 있어요.
          </p>
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
