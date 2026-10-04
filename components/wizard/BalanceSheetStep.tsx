"use client";

import { useState } from "react";
import {
  METHOD_LABELS,
  METHODS_BY_SIDE,
  createAccount,
  matchPreset,
  num,
  type Account,
  type Side,
  type ValuationMethod,
} from "@/lib/valuation/index.ts";
import ImportPanel from "./ImportPanel";
import { NumberInput, RemoveButton, ResultRow, StepSection, TextInput, formatWon } from "./ui";

const SIDE_LABEL: Record<Side, string> = { asset: "자산", liability: "부채" };

export default function BalanceSheetStep({
  accounts,
  valuationDate,
  fiscalYearEndMonth,
  onChange,
}: {
  accounts: Account[];
  valuationDate: string;
  fiscalYearEndMonth: number;
  onChange: (accounts: Account[]) => void;
}) {
  const update = (id: string, patch: Partial<Account>) =>
    onChange(accounts.map((account) => (account.id === id ? { ...account, ...patch } : account)));

  return (
    <StepSection
      title="재무상태표"
      description="평가기준일 현재 재무상태표를 엑셀에서 복사해 붙여넣으세요. 계정마다 평가 유형을 자동으로 정해 두니, 맞는지 확인하고 필요하면 바꿔 주세요. 다음 단계에서 유형별로 평가에 필요한 값을 입력합니다."
    >
      <ImportPanel
        side="asset"
        accounts={accounts}
        valuationDate={valuationDate}
        fiscalYearEndMonth={fiscalYearEndMonth}
        onChange={onChange}
      />

      {(["asset", "liability"] as Side[]).map((side) => {
        const rows = accounts.filter((account) => account.side === side);
        if (rows.length === 0) return null;
        const total = rows.reduce((sum, account) => sum + num(account.bookValue), 0);
        return (
          <div key={side} className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{SIDE_LABEL[side]}</h3>
            <div className="hidden grid-cols-[1fr_9rem_10rem_2.5rem] gap-2 px-1 text-xs text-zinc-500 sm:grid dark:text-zinc-400">
              <span>계정과목</span>
              <span className="text-right">재무상태표 금액</span>
              <span>평가 유형</span>
              <span />
            </div>
            {rows.map((account) => (
              <div key={account.id} className="grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_9rem_10rem_2.5rem] sm:items-center">
                <TextInput
                  value={account.name}
                  onChange={(name) => update(account.id, { name })}
                  placeholder="계정과목명"
                  ariaLabel="계정과목명"
                />
                <div className="sm:order-none order-last col-span-2 sm:col-span-1">
                  <NumberInput value={account.bookValue} onChange={(bookValue) => update(account.id, { bookValue })} ariaLabel="재무상태표 금액" />
                </div>
                <select
                  value={account.method}
                  onChange={(e) => update(account.id, { method: e.target.value as ValuationMethod })}
                  aria-label="평가 유형"
                  className="input order-last col-span-2 sm:order-none sm:col-span-1"
                >
                  {METHODS_BY_SIDE[side].map((method) => (
                    <option key={method} value={method}>
                      {METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
                <RemoveButton onClick={() => onChange(accounts.filter((a) => a.id !== account.id))} label={`${account.name || "계정"} 삭제`} />
              </div>
            ))}
            <ResultRow label={`${SIDE_LABEL[side]} 합계`} value={formatWon(total)} emphasize />
          </div>
        );
      })}

      <AddAccountRow onAdd={(account) => onChange([...accounts, account])} />
    </StepSection>
  );
}

function AddAccountRow({ onAdd }: { onAdd: (account: Account) => void }) {
  const [side, setSide] = useState<Side>("asset");
  const [name, setName] = useState("");

  function add() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(createAccount(side, trimmed, matchPreset(trimmed, side)?.method ?? "book"));
    setName("");
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-dashed border-zinc-300 p-3 dark:border-zinc-700">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">계정 직접 추가</span>
      <div className="flex flex-wrap items-center gap-2">
        <select value={side} onChange={(e) => setSide(e.target.value as Side)} aria-label="자산 또는 부채" className="input w-auto">
          <option value="asset">자산</option>
          <option value="liability">부채</option>
        </select>
        <div className="min-w-40 flex-1">
          <TextInput value={name} onChange={setName} placeholder="예: 정기예금" ariaLabel="추가할 계정과목명" />
        </div>
        <button type="button" onClick={add} className="btn-secondary">
          추가
        </button>
      </div>
    </div>
  );
}
