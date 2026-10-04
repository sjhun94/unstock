// 실행: node --test lib/valuation/importTax.test.ts  (모든 숫자는 가상의 값)
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateValuation,
  corporateTaxByBrackets,
  createAccount,
  createFixedAsset,
  createInitialState,
  parseBalanceSheet,
  parseIncomeAdjustments,
  parseReserves,
  parseTaxReturn,
  reviewValuation,
  rowsToAccounts,
  taxReturnPatch,
  yearIndexOf,
  type ValuationState,
} from "./index.ts";

const TAX_RETURN_PDF = [
  "법인세 과세표준 및 세액조정계산서",
  "사업연도 2023.01.01 ~ 2023.12.31",
  "① 결산서상 당기순손익 01 120,000,000",
  "⑩ 각 사업연도 소득금액 (⑩=⑧+⑨) 10 150,000,000",
  "⑪ 이월결손금 11 50,000,000",
  "⑬ 과세표준 (⑩-⑪-⑫) 13 100,000,000",
  "⑯ 산출세액 16 9,000,000",
  "⑰ 최저한세 적용 대상 공제감면세액 17 1,000,000",
  "⑱ 차감세액 18 8,000,000",
  "⑲ 최저한세 적용 제외 공제감면세액 19 500,000",
].join("\n");

test("세액조정계산서(PDF 텍스트): 사업연도·소득금액·세액 읽기, 이월결손금 공제 전 세액 재계산", () => {
  const r = parseTaxReturn(TAX_RETURN_PDF);
  assert.deepEqual(r.period, { start: "2023-01-01", end: "2023-12-31", months: 12 });
  assert.equal(r.taxableIncome, 150_000_000);
  assert.equal(r.lossCarryforward, 50_000_000);
  assert.equal(r.taxBase, 100_000_000);
  assert.equal(r.computedTax, 9_000_000);
  assert.equal(r.recomputedTax, 13_500_000); // 150,000,000 × 9%
  assert.equal(r.credits, 1_500_000);
  const patch = taxReturnPatch(r);
  assert.equal(patch.taxableIncome, "150000000");
  assert.equal(patch.computedTax, "13500000");
  assert.equal(patch.creditsNonRural, "1500000");
  assert.equal(patch.creditsRural, "");
  assert.equal(patch.period, "2023-01-01 ~ 2023-12-31");
});

test("세액조정계산서: 농어촌특별세가 있으면 감면세액을 농특세 과세분으로 나눔", () => {
  const patch = taxReturnPatch(parseTaxReturn(`${TAX_RETURN_PDF}\n농어촌특별세 200,000`));
  assert.equal(patch.creditsRural, "1000000"); // 200,000 ÷ 20%
  assert.equal(patch.creditsNonRural, "500000");
});

test("사업연도 → 몇 년 전 칸인지", () => {
  assert.equal(yearIndexOf("2023-12-31", "2024-09-30", 12), 0);
  assert.equal(yearIndexOf("2021-12-31", "2024-09-30", 12), 2);
  assert.equal(yearIndexOf("2020-12-31", "2024-09-30", 12), null);
  assert.equal(yearIndexOf("2024-03-31", "2024-09-30", 3), 0);
  // 평가기준일이 사업연도 말이면 그 사업연도는 제외
  assert.equal(yearIndexOf("2023-12-31", "2023-12-31", 12), null);
  assert.equal(yearIndexOf("2022-12-31", "2023-12-31", 12), 0);
});

test("법인세율 구간 계산", () => {
  assert.equal(corporateTaxByBrackets(300_000_000, 2023), 37_000_000);
  assert.equal(corporateTaxByBrackets(300_000_000, 2022), 40_000_000);
  assert.equal(corporateTaxByBrackets(100_000_000, 2023, 6), 9_000_000);
});

test("소득금액조정합계표(엑셀 표): 좌우 구분, 상증세법 항목만 반영", () => {
  const text = [
    "익금산입 및 손금불산입\t\t\t손금산입 및 익금불산입\t\t",
    "과목\t금액\t소득처분\t과목\t금액\t소득처분",
    "기업업무추진비 한도초과\t5,000,000\t기타사외유출\t감가상각비 손금추인\t1,000,000\t유보",
    "벌금 및 과태료\t300,000\t기타사외유출\t수입배당금 익금불산입\t2,000,000\t기타",
    "법인세비용\t20,000,000\t기타사외유출\t\t\t",
    "\t\t\t국세환급금이자\t100,000\t기타",
    "합계\t25,300,000\t\t합계\t3,100,000\t",
  ].join("\n");
  const r = parseIncomeAdjustments(text);
  assert.equal(r.items.length, 6);
  assert.deepEqual(
    r.items.map((i) => `${i.side}:${i.field}`),
    [
      "plus:entertainmentExcess",
      "minus:depreciationShortfall",
      "plus:fines",
      "minus:dividendExclusion",
      "plus:null",
      "minus:refundInterest",
    ],
  );
  assert.equal(r.patch.entertainmentExcess, "5000000");
  assert.equal(r.patch.fines, "300000");
  assert.equal(r.patch.depreciationShortfall, "-1000000");
  assert.equal(r.patch.dividendExclusion, "2000000");
  assert.equal(r.patch.refundInterest, "100000");
  assert.equal(r.patch.nonBusiness, "");
  assert.equal(r.patch.adjustmentsPasted, true);
});

test("소득금액조정합계표(PDF 텍스트): 한 줄에 두 항목이면 왼쪽 가산·오른쪽 차감, 한 항목이면 과목명으로 짐작", () => {
  const r = parseIncomeAdjustments(
    ["기업업무추진비한도초과 5,000,000 기타사외유출 감가상각비손금추인 1,000,000 유보", "국세환급금이자 100,000 기타"].join("\n"),
  );
  assert.deepEqual(
    r.items.map((i) => i.side),
    ["plus", "minus", "minus"],
  );
});

test("자본금과 적립금 조정명세서(을): 기말잔액 읽기, 이미 다시 평가한 계정의 유보는 제외", () => {
  const text = [
    "①과목 또는 사항\t②기초잔액\t③감소\t④증가\t⑤기말잔액",
    "대손충당금 한도초과\t1,000,000\t1,000,000\t1,200,000\t1,200,000",
    "감가상각비 부인액\t3,000,000\t500,000\t\t2,500,000",
    "미수수익\t△400,000\t△400,000\t△300,000\t△300,000",
    "합계\t3,600,000\t1,100,000\t900,000\t3,400,000",
  ].join("\n");
  const withRows = { ...createAccount("asset", "비품", "depreciation"), fixedAssets: [createFixedAsset()] };
  const r = parseReserves(text, [withRows]);
  assert.equal(r.skipped, 2);
  assert.deepEqual(
    r.rows.map((row) => [row.name, row.reserveAmount, row.includeAmount]),
    [
      ["대손충당금 한도초과", "1200000", "1200000"],
      ["감가상각비 부인액", "2500000", "0"],
      ["미수수익", "-300000", "0"],
    ],
  );
  // 감가상각 명세가 없으면 상각부인액 유보를 포함
  const noRows = parseReserves(text, [createAccount("asset", "비품", "depreciation")]);
  assert.equal(noRows.rows[1].includeAmount, "2500000");
});

const SHEET = [
  "자산",
  "보통예금\t1,000,000",
  "비품\t2,000,000",
  "자산총계\t3,000,000",
  "부채",
  "퇴직급여충당부채\t5,000,000",
  "퇴직연금운용자산\t(4,000,000)",
  "부채총계\t1,000,000",
  "자본",
  "자본금\t500,000",
  "자본총계\t2,000,000",
].join("\n");

test("재무상태표: 합계·자본금 읽기, 퇴직연금운용자산은 별도 자산", () => {
  const r = parseBalanceSheet(SHEET, "asset");
  assert.deepEqual(r.totals, { assetTotal: 3_000_000, liabilityTotal: 1_000_000, equityTotal: 2_000_000, capital: 500_000 });
  assert.deepEqual(
    r.rows.map((row) => `${row.side}:${row.name}:${row.amount}`),
    ["asset:보통예금:1000000", "asset:비품:2000000", "liability:퇴직급여충당부채:5000000", "asset:퇴직연금운용자산:4000000"],
  );
});

function stateWithSheet(): ValuationState {
  const parsed = parseBalanceSheet(SHEET, "asset");
  const state = createInitialState();
  state.basic = { ...state.basic, valuationDate: "2024-09-30", totalShares: "100", parValue: "5000", businessStartDate: "2010-01-01" };
  state.accounts = rowsToAccounts(parsed.rows);
  state.sheet = { date: null, label: "", ...parsed.totals };
  return state;
}

test("검토: 합계가 맞으면 불일치 없음, 소계 줄이 섞이면 불일치", () => {
  const state = stateWithSheet();
  const ids = (s: ValuationState) => reviewValuation(s, calculateValuation(s)).map((i) => i.id);
  assert.ok(!ids(state).includes("sheet.assetTotal"));
  assert.ok(!ids(state).includes("sheet.liabilityTotal"));
  assert.ok(!ids(state).includes("basic.capital")); // 5,000 × 100 = 500,000

  const withSubtotal = stateWithSheet();
  withSubtotal.accounts = [...withSubtotal.accounts, { ...createAccount("asset", "유형자산", "book"), bookValue: "2000000" }];
  assert.ok(ids(withSubtotal).includes("sheet.assetTotal"));
});

test("검토: 빠진 자료 요청, 확인했어요로 닫기, 유보 이중 반영 경고", () => {
  const empty = createInitialState();
  const emptyIds = reviewValuation(empty, calculateValuation(empty)).map((i) => i.id);
  assert.ok(emptyIds.includes("basic.valuationDate"));
  assert.ok(emptyIds.includes("basic.totalShares"));
  assert.ok(emptyIds.includes("sheet.empty"));

  const state = stateWithSheet();
  const items = reviewValuation(state, calculateValuation(state));
  // 3개 사업연도 신고서, 직원 명세(퇴직급여), 감가상각 명세 요청
  assert.equal(items.filter((i) => i.id.startsWith("netIncome.") && i.level === "request").length, 3);
  assert.ok(items.some((i) => i.level === "request" && i.document?.includes("급여대장")));
  assert.ok(items.some((i) => i.level === "request" && i.document?.includes("고정자산관리대장")));
  assert.ok(items.some((i) => i.id === "judgment.major"));

  state.dismissed = ["judgment.major"];
  assert.ok(!reviewValuation(state, calculateValuation(state)).some((i) => i.id === "judgment.major"));

  state.adjustments.reserves = [{ id: "r1", name: "퇴직급여충당금 한도초과", reserveAmount: "1000000", includeAmount: "1000000", note: "" }];
  assert.ok(reviewValuation(state, calculateValuation(state)).some((i) => i.id === "reserve.double.r1"));
});

test("평가방법 판정: 비워 두면 토지 기준시가·장부가액으로 부동산 비율 자동 계산", () => {
  const state = createInitialState();
  state.basic.totalShares = "1000";
  state.accounts = [
    { ...createAccount("asset", "토지", "realEstate"), bookValue: "700000000", standardValue: "900000000" },
    { ...createAccount("asset", "보통예금", "deposit"), bookValue: "300000000" },
  ];
  const result = calculateValuation(state);
  assert.equal(result.auto.deductLand, 700_000_000);
  assert.equal(result.auto.realEstateLand, 900_000_000);
  // (10억 − 7억 + 9억) = 12억 중 9억 = 75% → 부동산과다보유법인
  assert.equal(result.realEstate.ratio, 0.75);
  assert.equal(result.method.weights, "2:3");

  state.judgment.realEstateLand = "100000000"; // 직접 입력하면 자동값 대신 사용
  assert.equal(calculateValuation(state).method.weights, "3:2");
});
