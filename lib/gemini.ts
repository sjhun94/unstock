import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// 2026-07 기준 tax-rag 프로젝트에서 검증된 최신 모델과 동일하게 맞춤.
const GENERATION_MODEL = "gemini-3.5-flash";

export interface UploadedFile {
  data: Buffer;
  mimeType: string;
}

export interface NetProfitAnalysis {
  taxableIncome: number; // 세무조정계산서상 각사업연도소득금액(차가감소득금액)
  addBackAmount: number; // 가산 조정액 (수입배당금 익금불산입액 등)
  deductAmount: number; // 차감 조정액 (해당 사업연도 법인세·지방소득세 등)
  netProfitLoss: number; // 최종 순손익액 = taxableIncome + addBackAmount - deductAmount
  notes: string; // 특이사항, 불확실한 부분, 추가로 확인이 필요한 항목
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    taxableIncome: { type: "number" },
    addBackAmount: { type: "number" },
    deductAmount: { type: "number" },
    netProfitLoss: { type: "number" },
    notes: { type: "string" },
  },
  required: ["taxableIncome", "addBackAmount", "deductAmount", "netProfitLoss", "notes"],
} as const;

const PROMPT = `당신은 한국 세무 전문가입니다. 첨부된 두 문서(손익계산서, 세무조정계산서)를 분석해서
상속세 및 증여세법 시행령 제56조에 따른 "1주당 순손익액" 계산에 필요한 해당 사업연도의
순손익액을 계산하세요.

계산 방법:
1. 세무조정계산서에서 "각 사업연도 소득금액"(법인세법 제14조, 흔히 "차가감소득금액"으로
   표기됨)을 찾아 taxableIncome으로 기록하세요.
2. 다음 항목들이 문서에서 확인되면 모두 합산해서 가산하세요 (addBackAmount):
   - 국세·지방세 과오납분 환급이자
   - 수입배당금 익금불산입액 (지주회사·일반회사 모두 포함)
   - 기부금 손금산입한도 초과금액의 이월손금산입액
   - 업무용승용차 관련비용·처분손실의 이월 손금추인액
   - 화폐성 외화자산·부채 및 통화선도 등의 평가이익
3. 다음 항목들이 문서에서 확인되면 모두 합산해서 차감하세요 (deductAmount):
   - 벌금·과태료·가산금 및 체납처분비
   - 공과금 중 손금불산입액
   - 업무와 관련 없는 지출, 업무용승용차 관련비용·처분손실 손금불산입액
   - 각 세법에 규정하는 징수불이행 납부세액
   - 기부금 한도초과액과 비지정기부금
   - 접대비(기업업무추진비) 한도초과액과 직부인액
   - 지급이자 손금불산입액, 과다경비 등의 손금불산입액
   - 해당 사업연도의 법인세 총결정세액, 농어촌특별세, 법인지방소득세
     (단, 세액이 이월결손금 공제를 반영해 계산되어 있다면 이월결손금 공제 효과를
     제거한 후의 세액으로 재계산하세요 — 즉 이월결손금이 없었다고 가정했을 때의 세액)
   - 감가상각비 시인부족액에서 손금추인된 차감금액
   - 화폐성 외화자산·부채 및 통화선도 등의 평가손실
4. netProfitLoss = taxableIncome + addBackAmount - deductAmount 로 계산하세요.
5. 시행령 제56조에는 이 외에도 유상증자·감자 효과, 이월결손금, 자산수증이익 등
   세부 조정 항목이 있으나 문서만으로 판단하기 어려운 경우가 많습니다. 이런 항목을
   발견했거나 판단이 불확실한 부분이 있다면 notes에 구체적으로 적어주세요.
6. 문서에서 특정 항목을 찾지 못했다면 0으로 처리하고 notes에 그 사실을 적어주세요.

반드시 JSON으로만 응답하세요.`;

type GeminiPart = { text: string } | { inlineData: { data: string; mimeType: string } };

// Gemini SDK가 던지는 에러는 종종 날것의 JSON 문자열이라, 화면에 그대로 노출하지 않고
// 사람이 읽을 수 있는 한국어 메시지로 바꿔서 던집니다.
function toFriendlyError(error: unknown): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (rawMessage.includes("Unsupported MIME type")) {
    return new Error(
      "지원하지 않는 파일 형식이에요. PDF 또는 이미지(사진, 스캔본) 파일만 업로드할 수 있어요.",
    );
  }
  if (rawMessage.includes("UNAVAILABLE") || rawMessage.includes("high demand") || rawMessage.includes("503")) {
    return new Error("AI 서버가 일시적으로 혼잡해요. 잠시 후 다시 시도해주세요.");
  }
  if (rawMessage.includes("RESOURCE_EXHAUSTED") || rawMessage.includes("429")) {
    return new Error("요청이 너무 많아 잠시 제한됐어요. 잠시 후 다시 시도해주세요.");
  }
  return new Error("문서 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
}

async function callGemini<T>(
  prompt: string,
  labeledFiles: { label: string; file: UploadedFile }[],
  responseSchema: object,
): Promise<T> {
  const parts: GeminiPart[] = [{ text: prompt }];
  for (const { label, file } of labeledFiles) {
    parts.push({ text: `\n\n[${label}]` });
    parts.push({ inlineData: { data: file.data.toString("base64"), mimeType: file.mimeType } });
  }

  let result;
  try {
    result = await ai.models.generateContent({
      model: GENERATION_MODEL,
      contents: [{ role: "user", parts }],
      config: { responseMimeType: "application/json", responseSchema },
    });
  } catch (error) {
    throw toFriendlyError(error);
  }

  if (!result.text) {
    throw new Error("문서 분석 실패: Gemini API 응답이 비어 있습니다.");
  }

  try {
    return JSON.parse(result.text) as T;
  } catch {
    throw new Error("문서 분석 실패: 응답을 해석할 수 없습니다.");
  }
}

export async function analyzeNetProfitDocuments(
  incomeStatement: UploadedFile,
  taxAdjustment: UploadedFile,
): Promise<NetProfitAnalysis> {
  return callGemini<NetProfitAnalysis>(
    PROMPT,
    [
      { label: "손익계산서", file: incomeStatement },
      { label: "세무조정계산서", file: taxAdjustment },
    ],
    RESPONSE_SCHEMA,
  );
}

export interface NetAssetAnalysis {
  bookAssets: number; // 재무상태표상 자산총계
  bookLiabilities: number; // 재무상태표상 부채총계
  reserveAddition: number; // 유보 합계 (자본금과 적립금조정명세서(을))
  reserveSubtraction: number; // △유보(부인유보) 합계
  taxAdjustedAssets: number; // 세법상 자산총액 = bookAssets + reserveAddition - reserveSubtraction
  notes: string;
}

const NET_ASSET_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    bookAssets: { type: "number" },
    bookLiabilities: { type: "number" },
    reserveAddition: { type: "number" },
    reserveSubtraction: { type: "number" },
    taxAdjustedAssets: { type: "number" },
    notes: { type: "string" },
  },
  required: [
    "bookAssets",
    "bookLiabilities",
    "reserveAddition",
    "reserveSubtraction",
    "taxAdjustedAssets",
    "notes",
  ],
} as const;

const NET_ASSET_PROMPT = `당신은 한국 세무 전문가입니다. 첨부된 두 문서(재무상태표, 자본금과 적립금조정명세서(을))를
분석해서 상속세 및 증여세법 시행령 제55조에 따른 "세법상 자산총액"을 계산하세요.

계산 방법:
1. 재무상태표에서 "자산총계"를 찾아 bookAssets로, "부채총계"를 찾아 bookLiabilities로 기록하세요.
2. 자본금과 적립금조정명세서(을)에서 유보(익금산입·손금불산입으로 세무상 자산가치를 증가시키는
   항목) 잔액의 합계를 reserveAddition으로 기록하세요.
3. 같은 명세서에서 △유보(부인유보, 손금산입·익금불산입으로 세무상 자산가치를 감소시키는 항목)
   잔액의 합계를 reserveSubtraction으로 기록하세요 (양수로 기록).
4. taxAdjustedAssets = bookAssets + reserveAddition - reserveSubtraction 으로 계산하세요.
5. 문서에서 특정 항목을 찾지 못했다면 0으로 처리하고, 판단이 불확실한 항목이 있다면 notes에
   구체적으로 적어주세요.

반드시 JSON으로만 응답하세요.`;

export async function analyzeNetAssetDocuments(
  balanceSheet: UploadedFile,
  reserveSchedule: UploadedFile,
): Promise<NetAssetAnalysis> {
  return callGemini<NetAssetAnalysis>(
    NET_ASSET_PROMPT,
    [
      { label: "재무상태표", file: balanceSheet },
      { label: "자본금과 적립금조정명세서(을)", file: reserveSchedule },
    ],
    NET_ASSET_RESPONSE_SCHEMA,
  );
}
