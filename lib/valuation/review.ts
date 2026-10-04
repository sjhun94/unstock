// 검토 사항: 붙여넣은 자료를 서로 맞춰 보고 빠진 자료는 요청, 안 맞는 숫자는 알려 줌
import type { ValuationResult } from "./calculate.ts";
import { reserveDecision } from "./importTax.ts";
import { num, parseYmd } from "./num.ts";
import type { Account, ValuationMethod, ValuationState } from "./types.ts";

export type ReviewStep = "basic" | "balanceSheet" | "assets" | "liabilities" | "adjustments" | "netIncome" | "judgment";
export type ReviewLevel = "request" | "mismatch" | "check" | "done";

export interface ReviewItem {
  id: string;
  level: ReviewLevel; // request = 자료 요청, mismatch = 숫자 불일치, check = 확인 필요, done = 완료
  step: ReviewStep;
  title: string;
  detail?: string;
  document?: string; // 준비할 실무 서류
  dismissible?: boolean; // "확인했어요"로 닫을 수 있는지
}

const LEVEL_ORDER: Record<ReviewLevel, number> = { request: 0, mismatch: 1, check: 2, done: 3 };

// 평가기준일 직전 3개 사업연도의 종료일 (평가기준일이 속한 사업연도 제외)
export function fiscalYearEnds(valuationDate: string, fiscalYearEndMonth: number): string[] | null {
  const valuation = parseYmd(valuationDate);
  if (!valuation) return null;
  let year = valuation.y;
  if (Date.UTC(year, fiscalYearEndMonth, 0) >= Date.UTC(valuation.y, valuation.m - 1, valuation.d)) year -= 1;
  return [0, 1, 2].map((i) => {
    const end = new Date(Date.UTC(year - i, fiscalYearEndMonth, 0));
    return end.toISOString().slice(0, 10);
  });
}

const FALLBACK_REQUEST: Partial<Record<ValuationMethod, { what: string; document: string }>> = {
  realEstate: { what: "시가 또는 기준시가", document: "개별공시지가·건물 기준시가 (부동산공시가격알리미, 홈택스) 또는 감정평가서" },
  listedStock: { what: "평가기준일 전후 2개월 종가 평균과 보유 주식 수", document: "한국거래소 시세, 증권사 잔고증명" },
  manual: { what: "보유 주식의 평가액", document: "투자한 회사의 재무제표 (같은 방법으로 평가)" },
  depreciation: { what: "감가상각 명세", document: "고정자산관리대장 (취득일·취득가액·내용연수)" },
  deposit: { what: "연이율과 가입일", document: "정기예금 통장 또는 은행 앱" },
  receivable: { what: "5년 넘게 회수하는 채권의 현재가치", document: "채권 회수 일정 (약정서)" },
  provision: { what: "평가기준일 현재 확정된 금액", document: "지급 결의서·청구서 등 확정 근거" },
  corporateTax: { what: "평가기준일까지의 법인세 계산", document: "평가기준일까지 가결산한 손익과 세무조정 내역" },
  severance: { what: "직원별 급여와 입사일", document: "급여대장 (최근 3개월)·임직원 입사일 명세" },
};

const PENSION = /퇴직연금운용자산|퇴직보험예치금|국민연금전환금/;
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

// 받침에 따라 조사 고르기 (명세가 / 입사일이)
function josa(word: string, withBatchim: string, without: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return `${word}${without}`;
  return `${word}${code % 28 === 0 ? without : withBatchim}`;
}

export function reviewValuation(state: ValuationState, result: ValuationResult): ReviewItem[] {
  const items: ReviewItem[] = [];
  const add = (item: ReviewItem) => items.push(item);
  const { basic, accounts, adjustments, netIncome, judgment, sheet } = state;
  const values = new Map(result.accounts.map((a) => [a.id, a.value]));
  const fyMonth = num(basic.fiscalYearEndMonth) || 12;

  // ── 기본정보 ──
  if (!parseYmd(basic.valuationDate)) add({ id: "basic.valuationDate", level: "request", step: "basic", title: "평가기준일을 입력해 주세요" });
  if (num(basic.totalShares) <= 0)
    add({
      id: "basic.totalShares",
      level: "request",
      step: "basic",
      title: "발행주식총수를 입력해 주세요",
      document: "주식등변동상황명세서 또는 법인등기부등본",
    });
  if (!parseYmd(basic.businessStartDate))
    add({
      id: "basic.businessStartDate",
      level: "check",
      step: "basic",
      title: "사업개시일을 입력해 주세요",
      detail: "사업개시 후 3년 미만이면 순자산가치만으로 평가해요.",
      document: "사업자등록증",
      dismissible: true,
    });
  if (sheet?.capital && num(basic.parValue) > 0 && num(basic.totalShares) > 0) {
    const expected = num(basic.parValue) * num(basic.totalShares);
    if (expected !== sheet.capital)
      add({
        id: "basic.capital",
        level: "mismatch",
        step: "basic",
        title: `자본금(${won(sheet.capital)})이 액면가 × 발행주식총수(${won(expected)})와 달라요`,
        detail: "발행주식총수나 액면가를 확인해 주세요. 이익소각·감자 등으로 다를 수 있다면 '확인했어요'를 눌러 주세요.",
        document: "주식등변동상황명세서, 법인등기부등본",
        dismissible: true,
      });
  }

  // ── 재무상태표 ──
  const assets = accounts.filter((a) => a.side === "asset");
  const liabilities = accounts.filter((a) => a.side === "liability");
  if (accounts.length === 0) {
    add({
      id: "sheet.empty",
      level: "request",
      step: "balanceSheet",
      title: "재무상태표를 붙여넣어 주세요",
      document: "평가기준일 현재 재무상태표 (결산서·표준재무제표)",
    });
  } else if (sheet) {
    const bookOf = (list: Account[]) => list.reduce((sum, a) => sum + (values.get(a.id)?.book ?? 0), 0);
    const pension = assets.filter((a) => PENSION.test(a.name)).reduce((sum, a) => sum + (values.get(a.id)?.book ?? 0), 0);
    // 퇴직연금운용자산은 보통 부채 아래에서 차감 표시되므로, 따로 떼어 낸 만큼 자산 합계도 부채 합계도 커짐
    const compare = (id: string, label: string, list: Account[], total: number | null) => {
      if (total === null) return;
      const sum = bookOf(list);
      if (sum === total || sum - pension === total) return;
      const diff = sum - pension - total;
      const subtotal = diff > 0 ? list.find((a) => !PENSION.test(a.name) && values.get(a.id)?.book === diff) : undefined;
      add({
        id,
        level: "mismatch",
        step: "balanceSheet",
        title: `${label} 계정 합계가 ${label}총계와 ${won(Math.abs(diff))} 달라요`,
        detail: subtotal
          ? `'${subtotal.name}'(${won(diff)})은 소계 줄로 보여요. 아래 계정들의 합계라면 그 줄을 지워 주세요.`
          : diff > 0
            ? "'유형자산'·'투자자산' 같은 소계 줄이 계정으로 함께 들어갔는지 확인하고, 들어갔다면 그 줄을 지워 주세요."
            : "붙여넣을 때 빠진 줄이 있는지 확인해 주세요.",
      });
    };
    compare("sheet.assetTotal", "자산", assets, sheet.assetTotal);
    compare("sheet.liabilityTotal", "부채", liabilities, sheet.liabilityTotal);
    if (sheet.assetTotal !== null && sheet.liabilityTotal !== null && sheet.equityTotal !== null) {
      const gap = sheet.assetTotal - sheet.liabilityTotal - sheet.equityTotal;
      if (gap !== 0)
        add({
          id: "sheet.balance",
          level: "mismatch",
          step: "balanceSheet",
          title: `재무상태표 대차가 ${won(Math.abs(gap))} 맞지 않아요 (자산총계 − 부채총계 ≠ 자본총계)`,
          detail: "원본 재무상태표를 확인해 주세요.",
        });
    }
    if (sheet.date && basic.valuationDate && sheet.date !== basic.valuationDate)
      add({
        id: "sheet.date",
        level: "check",
        step: "balanceSheet",
        title: `재무상태표 기준일(${sheet.date})이 평가기준일(${basic.valuationDate})과 달라요`,
        detail: "그 사이 배당·증자·부동산 매각·큰 차입 같은 변동이 있으면 반영해 주세요.",
        dismissible: true,
      });
  }

  // ── 자산·부채 평가 ──
  let evaluated = 0;
  for (const account of accounts) {
    const value = values.get(account.id);
    if (!value) continue;
    const step: ReviewStep = account.side === "asset" ? "assets" : "liabilities";
    if (value.fallbackToBook) {
      const request = FALLBACK_REQUEST[account.method];
      add({
        id: `account.${account.id}`,
        level: "request",
        step,
        title: `'${account.name}' ${josa(request?.what ?? "평가에 필요한 값", "이", "가")} 필요해요`,
        detail: "지금은 재무상태표 금액으로 계산하고 있어요.",
        document: request?.document,
      });
      continue;
    }
    evaluated++;
    if (account.method === "depreciation" && account.fixedAssets.length > 0) {
      const gap = value.taxValue - value.book;
      if (Math.abs(gap) > Math.max(1_000_000, Math.abs(value.book) * 0.1))
        add({
          id: `depreciation.${account.id}`,
          level: "check",
          step,
          title: `'${account.name}' 감가상각 명세로 계산한 금액이 장부와 ${won(Math.abs(gap))} 달라요`,
          detail: "명세에 빠진 자산이 없는지 확인해 주세요. 상각부인액(유보)이 있으면 차이가 날 수 있어요.",
          document: "고정자산관리대장, 감가상각비조정명세서",
          dismissible: true,
        });
    }
  }
  const receivables = assets.filter((a) => a.method === "receivable");
  if (receivables.length > 0 && receivables.every((a) => a.uncollectible.trim() === ""))
    add({
      id: "receivable.uncollectible",
      level: "check",
      step: "assets",
      title: "회수할 수 없는 채권이 있는지 확인해 주세요",
      detail: "부도·파산·장기 미회수 채권은 평가액에서 빼야 해요.",
      document: "거래처원장, 채권 연령표",
      dismissible: true,
    });
  const hasTax = liabilities.some((a) => a.method === "corporateTax");
  if (accounts.length > 0 && !hasTax && adjustments.liabilityTaxEtc.trim() === "")
    add({
      id: "liability.corporateTax",
      level: "check",
      step: "adjustments",
      title: "평가기준일까지 생긴 소득에 대한 법인세 등을 부채에 넣어 주세요",
      detail: "재무상태표에 미지급법인세가 없어요. 결손이라 낼 세금이 없다면 '확인했어요'를 눌러 주세요.",
      document: "평가기준일까지 가결산한 손익과 세무조정 내역",
      dismissible: true,
    });
  if (accounts.length > 0 && adjustments.declaredPayables.trim() === "")
    add({
      id: "liability.declared",
      level: "check",
      step: "adjustments",
      title: "평가기준일 전에 결의한 배당·상여 중 아직 안 준 금액이 있나요?",
      detail: "재무상태표에 없는 경우가 많아요. 없으면 '확인했어요'를 눌러 주세요.",
      document: "이사회·주주총회 의사록",
      dismissible: true,
    });
  if (evaluated > 0) add({ id: "accounts.done", level: "done", step: "assets", title: `계정 ${evaluated}개 평가 완료` });

  // ── 유보 ──
  if (adjustments.reserves.length === 0) {
    if (accounts.length > 0)
      add({
        id: "reserves.empty",
        level: "request",
        step: "adjustments",
        title: "세무상 유보 명세를 붙여넣어 주세요",
        detail: "유보가 없는 회사라면 '확인했어요'를 눌러 주세요.",
        document: "자본금과 적립금 조정명세서(을) (법인세 신고서)",
        dismissible: true,
      });
  } else {
    for (const row of adjustments.reserves) {
      if (num(row.reserveAmount) === 0) continue;
      const decision = reserveDecision(row.name, accounts);
      const included = num(row.includeAmount) !== 0;
      if (!decision.include && included)
        add({
          id: `reserve.double.${row.id}`,
          level: "mismatch",
          step: "adjustments",
          title: `'${row.name}' 유보가 이미 다시 평가한 계정과 겹쳐요`,
          detail: `${decision.note}하는 게 맞아 보여요. '순자산에 가감'을 0으로 바꿔 주세요.`,
          dismissible: true,
        });
      else if (decision.include && !included)
        add({
          id: `reserve.missing.${row.id}`,
          level: "check",
          step: "adjustments",
          title: `'${row.name}' 유보를 순자산에 반영하지 않았어요`,
          detail: `${decision.note}하는 게 일반적이에요.`,
          dismissible: true,
        });
    }
    add({ id: "reserves.done", level: "done", step: "adjustments", title: `유보 ${adjustments.reserves.length}건 반영` });
  }

  // ── 순손익액 ──
  const ends = fiscalYearEnds(basic.valuationDate, fyMonth);
  const start = parseYmd(basic.businessStartDate);
  let filledYears = 0;
  netIncome.forEach((year, index) => {
    const end = ends?.[index];
    const label = end ? `${end.slice(0, 4)}년 ${fyMonth}월 결산 사업연도` : `${index + 1}년 전 사업연도`;
    if (start && end && Date.UTC(start.y, start.m - 1, start.d) > Date.parse(end)) return; // 사업 시작 전
    if (year.taxableIncome.trim() === "") {
      add({
        id: `netIncome.${index}.income`,
        level: "request",
        step: "netIncome",
        title: `${label} 법인세 신고서가 필요해요`,
        document: "법인세 과세표준 및 세액조정계산서",
      });
      return;
    }
    filledYears++;
    if (year.period && end && !year.period.endsWith(end))
      add({
        id: `netIncome.${index}.period`,
        level: "mismatch",
        step: "netIncome",
        title: `${index + 1}년 전 칸에 넣은 신고서의 사업연도(${year.period})가 ${label}와 달라요`,
        detail: "다른 해의 신고서를 넣었는지 확인해 주세요.",
        dismissible: true,
      });
    if (num(year.taxableIncome) > 0 && year.taxMode === "computed" && year.computedTax.trim() === "")
      add({
        id: `netIncome.${index}.tax`,
        level: "request",
        step: "netIncome",
        title: `${label} 산출세액이 필요해요`,
        document: "법인세 과세표준 및 세액조정계산서",
      });
    if (!year.adjustmentsPasted)
      add({
        id: `netIncome.${index}.adjustments`,
        level: "check",
        step: "netIncome",
        title: `${label} 소득금액조정합계표를 붙여넣어 주세요`,
        detail: "기업업무추진비 한도초과, 벌금 같은 항목을 자동으로 반영해요. 직접 입력했다면 '확인했어요'를 눌러 주세요.",
        document: "소득금액조정합계표 (법인세 신고서)",
        dismissible: true,
      });
    if (num(year.lossCarryforward) > 0)
      add({
        id: `netIncome.${index}.loss`,
        level: "done",
        step: "netIncome",
        title: `${label}: 이월결손금 공제 전 세액으로 다시 계산했어요`,
      });
  });
  if (filledYears > 0) add({ id: "netIncome.done", level: "done", step: "netIncome", title: `순손익액 ${filledYears}개 사업연도 입력` });

  // ── 평가방법 ──
  if (!judgment.isMajorShareholder)
    add({
      id: "judgment.major",
      level: "check",
      step: "judgment",
      title: "평가할 주식이 최대주주 등의 주식인지 확인해 주세요",
      detail: "최대주주 등의 주식은 20% 할증될 수 있어요. 해당하지 않으면 '확인했어요'를 눌러 주세요.",
      document: "주식등변동상황명세서",
      dismissible: true,
    });
  else
    add({
      id: "judgment.smallBusiness",
      level: "check",
      step: "judgment",
      title: "중소기업인지 확인해 주세요 (중소기업은 할증 제외)",
      document: "중소기업기준검토표 (법인세 신고서)",
      dismissible: true,
    });
  if (accounts.length > 0)
    add({
      id: "judgment.realEstate",
      level: "done",
      step: "judgment",
      title: `부동산 비율 ${(result.realEstate.ratio * 100).toFixed(1)}% 자동 판정 (${result.method.weights === "netAssetOnly" ? "순자산가치만" : result.method.weights === "2:3" ? "순손익 2 : 순자산 3" : "순손익 3 : 순자산 2"})`,
    });

  return items
    .filter((item) => !(item.dismissible && state.dismissed.includes(item.id)))
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
