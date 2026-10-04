"use client";

import ExpertContactCTA from "@/components/ExpertContactCTA";
import type { ValuationResult, ValuationState } from "@/lib/valuation/index.ts";
import { Note, ResultRow, StepSection, SubSection, formatPercent, formatWon } from "./ui";

const WEIGHT_LABELS = {
  "3:2": "순손익가치 3 : 순자산가치 2 가중평균",
  "2:3": "순손익가치 2 : 순자산가치 3 가중평균 (부동산과다보유법인)",
  netAssetOnly: "순자산가치만으로 평가",
} as const;

export default function ResultStep({
  state,
  result,
  pending,
}: {
  state: ValuationState;
  result: ValuationResult;
  pending: number; // 남은 자료 요청·불일치 건수
}) {
  const { netAsset, netIncome, goodwill, perShare, method } = result;
  const name = state.basic.companyName;
  const floorApplied = perShare.floor > perShare.weighted;

  return (
    <StepSection
      title="평가 결과"
      description={name ? `${name}의 비상장주식 평가 결과입니다.` : "비상장주식 평가 결과입니다."}
    >
      {!result.ready && (
        <Note tone="warning">발행주식총수를 입력하지 않아 1주당 금액을 계산할 수 없어요. 기본정보 단계에서 입력해 주세요.</Note>
      )}
      {pending > 0 && (
        <Note tone="warning">
          아직 필요한 자료나 맞지 않는 숫자가 {pending}건 있어요. 검토 사항을 처리하면 더 정확한 평가액이 나와요.
        </Note>
      )}

      <div className="flex flex-col gap-2 rounded-xl bg-zinc-900 p-5 text-white dark:bg-zinc-50 dark:text-zinc-900">
        <span className="text-xs opacity-70">1주당 평가액</span>
        <span className="text-3xl font-bold tabular-nums">{formatWon(perShare.final)}</span>
        <span className="text-sm tabular-nums opacity-80">총 평가액 {formatWon(result.totalValue)}</span>
      </div>

      <SubSection title="1주당 평가액 계산" description={WEIGHT_LABELS[method.weights]}>
        <ResultRow label="① 순손익가치 (1주당)" value={formatWon(perShare.byNetIncome)} />
        <ResultRow label="② 순자산가치 (1주당)" value={formatWon(perShare.byNetAsset)} />
        <ResultRow label="③ 가중평균 가액" value={formatWon(perShare.weighted)} />
        <ResultRow label="하한 (② × 80%)" value={formatWon(perShare.floor)} />
        <ResultRow label="할증 전 평가액 [③과 하한 중 큰 금액]" value={formatWon(perShare.base)} />
        <ResultRow
          label="최대주주 할증"
          value={perShare.premiumRate > 0 ? "20% 가산" : `미적용 (${perShare.premiumExemptReasons.join(", ")})`}
        />
        <ResultRow label="1주당 평가액" value={formatWon(perShare.final)} emphasize />
        {method.netAssetOnlyReasons.length > 0 && (
          <Note tone="warning">순자산가치만으로 평가한 사유: {method.netAssetOnlyReasons.join(", ")}</Note>
        )}
        {floorApplied && <Note tone="warning">가중평균 가액이 순자산가치의 80%에 못 미쳐 80%를 적용했습니다.</Note>}
      </SubSection>

      <SubSection title="순자산가액 계산서">
        <ResultRow label="재무상태표상 자산총액" value={formatWon(netAsset.assetBook)} />
        <ResultRow label="자산 평가차액" value={formatWon(netAsset.assetDiff)} />
        <ResultRow label="법인세법상 유보금액" value={formatWon(netAsset.reserveInclude)} />
        <ResultRow label="가. 자산총계" value={formatWon(netAsset.assetTotal)} emphasize />
        <ResultRow label="재무상태표상 부채총액" value={formatWon(netAsset.liabilityBook)} />
        <ResultRow label="부채 평가차액" value={formatWon(netAsset.liabilityDiff)} />
        <ResultRow label="법인세 등" value={formatWon(netAsset.liabilityTaxEtc)} />
        {netAsset.declaredPayables !== 0 && (
          <ResultRow label="결의된 배당금·상여금 미지급분" value={formatWon(netAsset.declaredPayables)} />
        )}
        <ResultRow label="나. 부채총계" value={formatWon(netAsset.liabilityTotal)} emphasize />
        <ResultRow label="다. 영업권 포함 전 순자산가액 (가 − 나)" value={formatWon(netAsset.beforeGoodwill)} />
        <ResultRow label="라. 영업권" value={formatWon(netAsset.goodwillApplied)} />
        <ResultRow label="마. 순자산가액 (다 + 라)" value={formatWon(netAsset.netAssetValue)} emphasize />
      </SubSection>

      <SubSection title="영업권 평가" description="(3년 가중평균 순손익액 × 50% − 자기자본 × 10%)의 5년간 현재가치 합계">
        <ResultRow label="3년 가중평균 순손익액" value={formatWon(goodwill.weightedNetIncome)} />
        <ResultRow label="× 50%" value={formatWon(goodwill.half)} />
        <ResultRow label="자기자본 × 10%" value={formatWon(goodwill.equityReturn)} />
        <ResultRow label="초과이익" value={formatWon(goodwill.excess)} />
        <ResultRow label="5년 현재가치 합계 (할인율 10%)" value={formatWon(goodwill.presentValue)} />
        <ResultRow label="매입한 영업권 차감" value={formatWon(goodwill.purchased)} />
        <ResultRow label="영업권 평가액" value={formatWon(goodwill.value)} emphasize />
        {goodwill.excluded && (
          <Note tone="warning">순자산가치만으로 평가하는 법인에 해당해 영업권을 순자산가액에 합산하지 않았습니다.</Note>
        )}
        {!goodwill.excluded && goodwill.value < 0 && <Note>영업권 평가액이 음수이므로 0으로 반영했습니다.</Note>}
      </SubSection>

      <SubSection title="순손익가치 계산">
        {netIncome.years.map((year, index) => (
          <ResultRow key={index} label={`${index + 1}년 전 1주당 순손익액`} value={formatWon(year.perShare)} />
        ))}
        <ResultRow label="가중평균액 (3 : 2 : 1, 0 미만이면 0)" value={formatWon(netIncome.weightedPerShare)} />
        <ResultRow
          label={`순손익가치 (가중평균액 ÷ 환원율 ${formatPercent(netIncome.rate)})`}
          value={formatWon(netIncome.valuePerShare)}
          emphasize
        />
      </SubSection>

      <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
        본 계산 결과는 상속세 및 증여세법 시행령 제54조~제56조, 제59조의 보충적 평가방법에 따라 입력값을 기준으로 산출한
        참고용 수치입니다. 자산별 시가 평가, 세무조정 내역 등은 입력한 내용에 따라 달라지므로 실제 신고·의사결정 전에는
        반드시 세무 전문가의 검토를 받으시기 바랍니다.
      </p>

      <ExpertContactCTA />
    </StepSection>
  );
}
