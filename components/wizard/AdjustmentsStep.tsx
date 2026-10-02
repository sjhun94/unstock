"use client";

import { createReserve, num, type Adjustments } from "@/lib/valuation/index.ts";
import { Field, MiniField, NumberInput, RemoveButton, ResultRow, SmallButton, StepSection, SubSection, TextInput, formatWon } from "./ui";

export default function AdjustmentsStep({ value, onChange }: { value: Adjustments; onChange: (value: Adjustments) => void }) {
  const rows = value.reserves;
  const setRows = (reserves: Adjustments["reserves"]) => onChange({ ...value, reserves });
  const includeTotal = rows.reduce((sum, row) => sum + num(row.includeAmount), 0);

  return (
    <StepSection title="유보·조정" description="세무상 유보금액과 순자산가액 계산에 필요한 그 밖의 조정 사항을 입력하세요.">
      <SubSection
        title="세무상 유보금액"
        description="자본금과 적립금조정명세서(을)의 유보 잔액 중 순자산에 더하거나 뺄 금액을 적습니다. 앞 단계의 평가차액에서 이미 반영한 항목은 '순자산에 가감'을 0으로 두세요. 차감할 유보(△유보)는 음수로 입력합니다."
      >
        {rows.map((row) => {
          const update = (patch: Partial<typeof row>) => setRows(rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
          return (
            <div key={row.id} className="flex flex-wrap items-end gap-2">
              <MiniField label="과목 또는 사항" className="min-w-40 flex-1">
                <TextInput value={row.name} onChange={(name) => update({ name })} placeholder="예: 대손충당금 한도초과" />
              </MiniField>
              <MiniField label="유보금액" className="w-36">
                <NumberInput value={row.reserveAmount} onChange={(reserveAmount) => update({ reserveAmount })} />
              </MiniField>
              <MiniField label="순자산에 가감" className="w-36">
                <NumberInput value={row.includeAmount} onChange={(includeAmount) => update({ includeAmount })} />
              </MiniField>
              <RemoveButton onClick={() => setRows(rows.filter((r) => r.id !== row.id))} label="유보 항목 삭제" />
            </div>
          );
        })}
        <SmallButton onClick={() => setRows([...rows, createReserve()])}>유보 항목 추가</SmallButton>
        <ResultRow label="순자산에 가감할 유보금액 합계" value={formatWon(includeTotal)} emphasize />
      </SubSection>

      <Field
        label="부채에 가산할 법인세 등"
        hint="평가기준일까지 발생한 소득에 대한 법인세·농어촌특별세·지방소득세 중 재무제표에 반영되지 않은 금액. 이미 반영되어 있으면 비워두세요."
      >
        <NumberInput value={value.liabilityTaxEtc} onChange={(liabilityTaxEtc) => onChange({ ...value, liabilityTaxEtc })} />
      </Field>

      <Field
        label="매입한 무체재산권으로서 영업권"
        hint="유상으로 취득해 평가기준일 현재 따로 평가한 영업권 금액. 자동 계산된 영업권 평가액에서 차감됩니다."
      >
        <NumberInput value={value.purchasedGoodwill} onChange={(purchasedGoodwill) => onChange({ ...value, purchasedGoodwill })} />
      </Field>

      <Field label="순손익가치 환원율 (%)" required hint="기획재정부령으로 정하는 이자율. 현재 10%입니다.">
        <NumberInput
          value={value.capitalizationRatePercent}
          onChange={(capitalizationRatePercent) => onChange({ ...value, capitalizationRatePercent })}
          placeholder="10"
        />
      </Field>
    </StepSection>
  );
}
