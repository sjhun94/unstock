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

const PROMPT = `당신은 한국 세무 전문가입니다. 첨부된 두 문서(재무상태표, 세무조정계산서)를 분석해서
상속세 및 증여세법 시행령 제56조에 따른 "1주당 순손익액" 계산에 필요한 해당 사업연도의
순손익액을 계산하세요.

계산 방법:
1. 세무조정계산서에서 "각 사업연도 소득금액"(법인세법 제14조, 흔히 "차가감소득금액"으로
   표기됨)을 찾아 taxableIncome으로 기록하세요.
2. 다음 항목이 문서에서 확인되면 가산하세요 (addBackAmount): 수입배당금 익금불산입액
   (법인세법 제18조의2, 제18조의4) 등 시행령 제56조 제4항 제1호에 해당하는 가산 항목.
3. 다음 항목이 문서에서 확인되면 차감하세요 (deductAmount): 해당 사업연도의 법인세액
   (외국납부세액공제분 포함), 법인세 감면에 대한 농어촌특별세, 법인지방소득세 등
   시행령 제56조 제4항 제2호에 해당하는 차감 항목.
4. netProfitLoss = taxableIncome + addBackAmount - deductAmount 로 계산하세요.
5. 시행령 제56조에는 이 외에도 기부금 한도초과 이월공제, 이월결손금, 자산수증이익 등
   세부 조정 항목이 있으나 문서만으로 판단하기 어려운 경우가 많습니다. 이런 항목을
   발견했거나 판단이 불확실한 부분이 있다면 notes에 구체적으로 적어주세요.
6. 문서에서 특정 항목을 찾지 못했다면 0으로 처리하고 notes에 그 사실을 적어주세요.

반드시 JSON으로만 응답하세요.`;

export async function analyzeNetProfitDocuments(
  balanceSheet: UploadedFile,
  taxAdjustment: UploadedFile,
): Promise<NetProfitAnalysis> {
  const result = await ai.models.generateContent({
    model: GENERATION_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { text: PROMPT },
          { text: "\n\n[재무상태표]" },
          { inlineData: { data: balanceSheet.data.toString("base64"), mimeType: balanceSheet.mimeType } },
          { text: "\n\n[세무조정계산서]" },
          { inlineData: { data: taxAdjustment.data.toString("base64"), mimeType: taxAdjustment.mimeType } },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
    },
  });

  if (!result.text) {
    throw new Error("문서 분석 실패: Gemini API 응답이 비어 있습니다.");
  }

  let parsed: NetProfitAnalysis;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    throw new Error("문서 분석 실패: 응답을 해석할 수 없습니다.");
  }

  return parsed;
}
