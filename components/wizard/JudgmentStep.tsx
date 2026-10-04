"use client";

import type { Judgment, ValuationResult } from "@/lib/valuation/index.ts";
import { Checkbox, MiniField, Note, NumberInput, ResultRow, StepSection, SubSection, formatPercent, formatWon } from "./ui";

export default function JudgmentStep({
  value,
  result,
  onChange,
}: {
  value: Judgment;
  result: ValuationResult;
  onChange: (value: Judgment) => void;
}) {
  const set = (patch: Partial<Judgment>) => onChange({ ...value, ...patch });
  const { realEstate, method, auto } = result;
  const autoWon = (n: number) => `자동 ${formatWon(n)}`;

  return (
    <StepSection
      title="평가방법 판정"
      description="순손익가치와 순자산가치를 어떤 비율로 반영할지, 최대주주 할증을 적용할지 판정합니다."
    >
      <SubSection
        title="부동산과다보유법인 판정"
        description="부동산 등 비율이 50%를 넘으면 순손익 2 : 순자산 3으로, 80% 이상이면 순자산가치만으로 평가합니다. 칸을 비워 두면 재무상태표·자산 평가·유보에서 자동으로 계산한 값(흐린 글씨)을 써요. 다르게 보려면 직접 입력하세요."
      >
        <ResultRow label="① 장부상 총자산 (자산 단계 합계)" value={formatWon(realEstate.bookAssets)} />
        <MiniField label="② 유보금액 가감">
          <NumberInput value={value.reserveAdjust} onChange={(reserveAdjust) => set({ reserveAdjust })} placeholder={autoWon(auto.reserveAdjust)} />
        </MiniField>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">④ 총자산에서 빼는 금액 (장부가액)</span>
        <div className="grid gap-2 sm:grid-cols-2">
          <MiniField label="토지">
            <NumberInput value={value.deductLand} onChange={(deductLand) => set({ deductLand })} placeholder={autoWon(auto.deductLand)} />
          </MiniField>
          <MiniField label="건물 (부속 시설물·구축물 포함)">
            <NumberInput value={value.deductBuilding} onChange={(deductBuilding) => set({ deductBuilding })} placeholder={autoWon(auto.deductBuilding)} />
          </MiniField>
          <MiniField label="무형자산">
            <NumberInput value={value.deductIntangible} onChange={(deductIntangible) => set({ deductIntangible })} placeholder={autoWon(auto.deductIntangible)} />
          </MiniField>
          <MiniField label="1년 내 차입·증자로 늘어난 금융자산·대여금">
            <NumberInput value={value.deductFinancial} onChange={(deductFinancial) => set({ deductFinancial })} />
          </MiniField>
        </div>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">⑤ 부동산 보유금액 [기준시가와 장부가액 중 큰 금액]</span>
        <div className="grid gap-2 sm:grid-cols-3">
          <MiniField label="토지">
            <NumberInput value={value.realEstateLand} onChange={(realEstateLand) => set({ realEstateLand })} placeholder={autoWon(auto.realEstateLand)} />
          </MiniField>
          <MiniField label="건물">
            <NumberInput value={value.realEstateBuilding} onChange={(realEstateBuilding) => set({ realEstateBuilding })} placeholder={autoWon(auto.realEstateBuilding)} />
          </MiniField>
          <MiniField label="부동산과다법인 주식의 부동산 상당액">
            <NumberInput value={value.realEstateStock} onChange={(realEstateStock) => set({ realEstateStock })} />
          </MiniField>
        </div>
        <ResultRow label="⑥ 조정 후 세무상 총자산" value={formatWon(realEstate.adjustedAssets)} />
        <ResultRow
          label="⑦ 부동산 보유비율"
          value={`${formatPercent(realEstate.ratio)} (${realEstate.isOver80 ? "80% 이상" : realEstate.isHeavy ? "부동산과다보유법인" : "해당 없음"})`}
          emphasize
        />
      </SubSection>

      <SubSection title="순자산가치만으로 평가하는 사유" description="하나라도 해당하면 순손익가치를 쓰지 않고 순자산가치만으로 평가합니다.">
        <MiniField label="자산총액 중 주식 등의 비율 (%) — 80% 이상이면 해당">
          <NumberInput value={value.stockRatioPercent} onChange={(stockRatioPercent) => set({ stockRatioPercent })} placeholder={`자동 ${auto.stockRatioPercent}%`} />
        </MiniField>
        <Checkbox checked={value.liquidation} onChange={(liquidation) => set({ liquidation })}>
          청산절차가 진행 중이거나 사업을 계속하기 곤란한 법인
        </Checkbox>
        <Checkbox checked={value.dormant} onChange={(dormant) => set({ dormant })}>
          사업개시 전이거나 휴업·폐업 중인 법인
        </Checkbox>
        <Checkbox checked={value.deficit3y} onChange={(deficit3y) => set({ deficit3y })}>
          평가기준일 전 3년 내 사업연도부터 계속 결손인 법인
        </Checkbox>
        <Checkbox checked={value.limitedLife} onChange={(limitedLife) => set({ limitedLife })}>
          잔여 존속기한이 3년 이내인 법인
        </Checkbox>
        <Note>
          사업개시 후 3년 미만 여부는 기본정보의 날짜로, 3개년 연속 결손 여부는 순손익액 단계의 소득금액으로 자동 판정합니다.
          {method.netAssetOnlyReasons.length > 0 && <b> 현재 해당 사유: {method.netAssetOnlyReasons.join(", ")}</b>}
        </Note>
      </SubSection>

      <SubSection
        title="최대주주 할증평가"
        description="최대주주 및 특수관계인의 주식은 평가액에 20%를 더합니다. 아래 제외 사유에 해당하면 할증하지 않습니다."
      >
        <Checkbox checked={value.isMajorShareholder} onChange={(isMajorShareholder) => set({ isMajorShareholder })}>
          평가 대상 주식이 최대주주 등의 주식입니다
        </Checkbox>
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">할증 제외 사유</span>
        <Checkbox checked={value.isSmallBusiness} onChange={(isSmallBusiness) => set({ isSmallBusiness })}>
          중소기업 (또는 할증 제외 대상 중견기업)
        </Checkbox>
        <Checkbox checked={value.mergerCase} onChange={(mergerCase) => set({ mergerCase })}>
          합병·증자·감자·현물출자 등에 따른 증여이익을 계산하는 경우
        </Checkbox>
        <Checkbox checked={value.earlyNoProfit} onChange={(earlyNoProfit) => set({ earlyNoProfit })}>
          사업개시 3년 이내이고 영업이익이 모두 0 이하인 경우
        </Checkbox>
        <Checkbox checked={value.liquidationConfirmed} onChange={(liquidationConfirmed) => set({ liquidationConfirmed })}>
          평가 대상 법인의 청산이 확정된 경우
        </Checkbox>
        <Checkbox checked={value.otherExempt} onChange={(otherExempt) => set({ otherExempt })}>
          그 밖의 할증 제외 사유
        </Checkbox>
        <ResultRow
          label="할증평가"
          value={result.perShare.premiumRate > 0 ? "20% 적용" : `미적용 (${result.perShare.premiumExemptReasons[0]})`}
          emphasize
        />
      </SubSection>
    </StepSection>
  );
}
