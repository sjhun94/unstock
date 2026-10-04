// 실행: node --test lib/landPrice.test.ts  (응답 모양만 흉내 낸 가상의 데이터)
import assert from "node:assert/strict";
import { test } from "node:test";
import { landStandardValue, parseLand, parsePrices, parseSearch, pickPrice } from "./landPrice.ts";

test("주소 검색 응답에서 필지 고유번호와 지번 주소 읽기", () => {
  const json = {
    response: {
      status: "OK",
      result: {
        items: [
          { id: "1111010100100010000", address: { parcel: "가상시 가상구 가상동 1" } },
          { id: "not-a-pnu", address: { parcel: "무시" } },
        ],
      },
    },
  };
  assert.deepEqual(parseSearch(json), [{ pnu: "1111010100100010000", address: "가상시 가상구 가상동 1" }]);
});

test("개별공시지가·토지대장 응답 읽기", () => {
  const prices = parsePrices({
    indvdLandPrices: {
      field: [
        { stdrYear: "2024", pblntfPclnd: "1000000", pblntfDe: "2024-04-30" },
        { stdrYear: "2023", pblntfPclnd: "900,000", pblntfDe: "20230428" },
      ],
    },
  });
  assert.deepEqual(prices, [
    { year: 2024, pricePerSqm: 1_000_000, announcedDate: "2024-04-30" },
    { year: 2023, pricePerSqm: 900_000, announcedDate: "2023-04-28" },
  ]);
  assert.deepEqual(parseLand({ ladfrlVOList: { ladfrlVOList: [{ lndpclAr: "330.5", lndcgrCodeNm: "대" }] } }), {
    area: 330.5,
    landCategory: "대",
  });
});

test("평가기준일 현재 고시된 가장 최근 공시지가를 고름", () => {
  const records = [
    { year: 2024, pricePerSqm: 1_000_000, announcedDate: "2024-04-30" },
    { year: 2023, pricePerSqm: 900_000, announcedDate: "2023-04-28" },
  ];
  assert.equal(pickPrice(records, "2024-09-30")?.year, 2024);
  assert.equal(pickPrice(records, "2024-03-15")?.year, 2023); // 2024년 가격 고시 전
  // 공시일자를 모르면 5월 31일 고시로 봄
  assert.equal(pickPrice([{ year: 2024, pricePerSqm: 1, announcedDate: null }], "2024-05-30"), null);
  assert.equal(pickPrice([{ year: 2024, pricePerSqm: 1, announcedDate: null }], "2024-05-31")?.year, 2024);
});

test("기준시가 = ㎡당 공시지가 × 면적 × 지분", () => {
  assert.equal(landStandardValue(1_000_000, 330.5), 330_500_000);
  assert.equal(landStandardValue(1_000_000, 330.5, 50), 165_250_000);
});
