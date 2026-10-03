// 실행: node --test lib/valuation/importSheet.test.ts  (가상의 숫자)
import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBalanceSheet, rowsToAccounts } from "./index.ts";

const SHEET = [
  "과목\t당기\t전기",
  "자산\t\t",
  "Ⅰ. 유동자산\t1,500,000\t1,000,000",
  "(1) 당좌자산\t\t",
  "보통예금\t200,000\t150,000",
  "외상매출금\t800,000\t700,000",
  "대손충당금\t(8,000)\t(7,000)",
  "Ⅱ. 비유동자산\t\t",
  "비품\t1,000,000\t1,000,000",
  "감가상각누계액\t-400,000\t-300,000",
  "임차보증금\t100,000\t100,000",
  "이연법인세자산\t30,000\t25,000",
  "자산총계\t1,722,000\t1,668,000",
  "부채\t\t",
  "미지급금\t90,000\t80,000",
  "미지급비용\t35,000\t30,000",
  "예수금\t8,000\t7,000",
  "부가세예수금\t25,000\t20,000",
  "미지급법인세\t60,000\t50,000",
  "퇴직급여충당부채\t40,000\t35,000",
  "부채총계\t258,000\t222,000",
  "자본\t\t",
  "자본금\t50,000\t50,000",
  "이익잉여금\t1,414,000\t1,396,000",
  "자본총계\t1,464,000\t1,446,000",
].join("\n");

test("재무상태표 붙여넣기: 자산·부채 구분, 차감계정 합산, 제목·합계·자본 제외", () => {
  const { rows } = parseBalanceSheet(SHEET, "asset");
  const summary = rows.map((r) => `${r.side}:${r.name}:${r.amount}:${r.method}`);
  assert.deepEqual(summary, [
    "asset:보통예금:200000:deposit",
    "asset:외상매출금:792000:book",
    "asset:비품:600000:depreciation",
    "asset:임차보증금:100000:book",
    "asset:이연법인세자산:30000:zero",
    "liability:미지급금:90000:unconfirmed",
    "liability:미지급비용:35000:manual",
    "liability:예수금:8000:book",
    "liability:부가세예수금:25000:book",
    "liability:미지급법인세:60000:corporateTax",
    "liability:퇴직급여충당부채:40000:severance",
  ]);
});

test("제목 줄이 없으면 현재 단계 구분을 따름", () => {
  const { rows } = parseBalanceSheet("차입금\t1,000\n선수금\t500", "liability");
  assert.deepEqual(rows.map((r) => `${r.side}:${r.method}`), ["liability:book", "liability:book"]);
});

test("앞쪽 계정코드 열은 무시하고 계정명 다음의 첫 금액을 사용", () => {
  const { rows } = parseBalanceSheet("1010505050\t보통예금\t200,000\t150,000", "asset");
  assert.equal(rows[0].name, "보통예금");
  assert.equal(rows[0].amount, 200000);
});

test("직접 입력 방식 계정은 평가액을 장부가액으로 미리 채움", () => {
  const accounts = rowsToAccounts(parseBalanceSheet("부채\n미지급비용\t35,000", "asset").rows);
  assert.equal(accounts[0].manualValue, "35000");
  assert.equal(accounts[0].bookValue, "35000");
});

import { parseDateCell, parseEmployees, parseFixedAssets } from "./index.ts";

test("날짜 형식 인식", () => {
  assert.equal(parseDateCell("2018-08-30"), "2018-08-30");
  assert.equal(parseDateCell("2018.8.3"), "2018-08-03");
  assert.equal(parseDateCell("2018. 8. 30."), "2018-08-30");
  assert.equal(parseDateCell("2018/08/30"), "2018-08-30");
  assert.equal(parseDateCell("20180830"), "2018-08-30");
  assert.equal(parseDateCell("2018-02-30"), null);
  assert.equal(parseDateCell("1,000,000"), null);
});

test("자산 명세 붙여넣기: 헤더·합계 제외, 취득가액·내용연수·상각방법·상각률 인식", () => {
  const text = [
    "자산명\t취득일\t취득가액\t내용연수\t상각방법",
    "노트북\t2023-01-15\t1,000,000\t5\t정률법",
    "서버\t2022.07.01\t12,000,000\t4\t정액법\t0.25",
    "모니터\t2024/03/02\t300,000",
    "합계\t\t13,300,000",
  ].join("\n");
  const { rows, skipped } = parseFixedAssets(text);
  assert.equal(skipped, 2);
  assert.deepEqual(
    rows.map((r) => [r.name, r.acquisitionDate, r.cost, r.usefulLifeYears, r.method, r.rate]),
    [
      ["노트북", "2023-01-15", "1000000", "5", "declining", ""],
      ["서버", "2022-07-01", "12000000", "4", "straight", "0.25"],
      ["모니터", "2024-03-02", "300000", "5", "declining", ""],
    ],
  );
});

test("직원 명세 붙여넣기: 금액 개수에 따라 급여·상여 배정", () => {
  const text = [
    "성명\t입사일\t7월\t8월\t9월\t상여",
    "직원A\t2020-09-30\t3,000,000\t3,100,000\t3,200,000\t6,000,000",
    "직원B\t2021.03.02\t2,500,000",
    "직원C\t2022-01-03\t4,000,000\t8,000,000",
    "합계\t\t9,500,000",
  ].join("\n");
  const { rows, skipped } = parseEmployees(text);
  assert.equal(skipped, 2);
  assert.deepEqual(
    rows.map((r) => [r.name, r.hireDate, r.wage1, r.wage2, r.wage3, r.annualBonus]),
    [
      ["직원A", "2020-09-30", "3000000", "3100000", "3200000", "6000000"],
      ["직원B", "2021-03-02", "2500000", "2500000", "2500000", ""],
      ["직원C", "2022-01-03", "4000000", "4000000", "4000000", "8000000"],
    ],
  );
});
