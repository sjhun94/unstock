"use client";

import { createReserve, num, parseReserves, type Account, type Adjustments, type ReserveRow } from "@/lib/valuation/index.ts";
import RowPastePanel from "./RowPastePanel";
import { Field, MiniField, NumberInput, RemoveButton, ResultRow, SmallButton, StepSection, SubSection, TextInput, formatWon } from "./ui";

export default function AdjustmentsStep({
  value,
  accounts,
  onChange,
}: {
  value: Adjustments;
  accounts: Account[];
  onChange: (value: Adjustments) => void;
}) {
  const rows = value.reserves;
  const setRows = (reserves: Adjustments["reserves"]) => onChange({ ...value, reserves });
  const includeTotal = rows.reduce((sum, row) => sum + num(row.includeAmount), 0);

  return (
    <StepSection title="유보·조정" description="세무상 유보금액과 순자산가액 계산에 필요한 그 밖의 조정 사항을 입력하세요.">
      <SubSection
        title="세무상 유보금액"
        description="법인세 신고서의 자본금과 적립금 조정명세서(을)를 붙여넣으면 기말 잔액을 읽고, 앞 단계에서 이미 다시 평가한 계정(토지·감가상각자산·퇴직급여 등)과 겹치는 유보는 자동으로 빼요. 차감할 유보(△유보)는 음수입니다."
      >
        <RowPastePanel<ReserveRow>
          title="자본금과 적립금 조정명세서(을) 붙여넣기"
          description="과목·기초잔액·감소·증가·기말잔액 열이 있는 표를 그대로 복사해 붙여넣으세요. PDF에서 복사한 텍스트도 읽어요."
          placeholder={"①과목 또는 사항\t②기초잔액\t③감소\t④증가\t⑤기말잔액\n대손충당금 한도초과\t1,000,000\t1,000,000\t1,200,000\t1,200,000\n..."}
          parse={(text) => parseReserves(text, accounts)}
          columns={[
            { label: "과목", render: (row) => row.name },
            { label: "기말 유보", render: (row) => formatWon(num(row.reserveAmount)), align: "right" },
            { label: "순자산 가감", render: (row) => formatWon(num(row.includeAmount)), align: "right" },
            { label: "이유", render: (row) => <span className="text-zinc-500">{row.note}</span> },
          ]}
          hasExisting={rows.length > 0}
          emptyMessage="읽을 수 있는 줄이 없어요. 과목명과 금액이 있는 열을 함께 복사했는지 확인해 주세요."
          onApply={(imported, mode) => setRows(mode === "replace" ? imported : [...rows, ...imported])}
        />
        {rows.map((row) => {
          const update = (patch: Partial<typeof row>) => setRows(rows.map((r) => (r.id === row.id ? { ...r, ...patch } : r)));
          return (
            <div key={row.id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-end gap-2">
                <MiniField label="과목 또는 사항" className="min-w-40 flex-1">
                  <TextInput value={row.name} onChange={(name) => update({ name })} placeholder="예: 대손충당금 한도초과" />
                </MiniField>
                <MiniField label="유보금액" className="w-36">
                  <NumberInput value={row.reserveAmount} onChange={(reserveAmount) => update({ reserveAmount })} />
                </MiniField>
                <MiniField label="순자산에 가감" className="w-36">
                  <NumberInput value={row.includeAmount} onChange={(includeAmount) => update({ includeAmount, note: "" })} />
                </MiniField>
                <RemoveButton onClick={() => setRows(rows.filter((r) => r.id !== row.id))} label="유보 항목 삭제" />
              </div>
              {row.note && <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.note}</p>}
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
        label="결의된 배당금·상여금 미지급분"
        hint="평가기준일 전에 이사회·주주총회에서 결의했지만 아직 주지 않은 배당금·상여금 등으로, 재무제표에 반영되지 않은 금액. 부채에 더합니다."
      >
        <NumberInput value={value.declaredPayables} onChange={(declaredPayables) => onChange({ ...value, declaredPayables })} />
      </Field>

      <Field
        label="매입한 무체재산권으로서 영업권"
        hint="유상으로 취득해 평가기준일 현재 따로 평가한 영업권 금액. 자동 계산된 영업권 평가액에서 차감됩니다."
      >
        <NumberInput value={value.purchasedGoodwill} onChange={(purchasedGoodwill) => onChange({ ...value, purchasedGoodwill })} />
      </Field>

      <Field label="순손익가치 환원율 (%)" hint="기획재정부령으로 정하는 이자율. 현재 10%입니다.">
        <NumberInput
          value={value.capitalizationRatePercent}
          onChange={(capitalizationRatePercent) => onChange({ ...value, capitalizationRatePercent })}
          placeholder="10"
        />
      </Field>
    </StepSection>
  );
}
