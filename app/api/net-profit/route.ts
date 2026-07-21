import { NextRequest, NextResponse } from "next/server";
import { analyzeNetProfitDocuments } from "@/lib/gemini";

export const maxDuration = 60;

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const incomeStatementFile = formData.get("incomeStatement");
  const taxAdjustmentFile = formData.get("taxAdjustment");

  if (!(incomeStatementFile instanceof File) || !(taxAdjustmentFile instanceof File)) {
    return NextResponse.json(
      { error: "손익계산서와 세무조정계산서 파일을 모두 첨부해주세요." },
      { status: 400 },
    );
  }

  try {
    const analysis = await analyzeNetProfitDocuments(
      { data: await fileToBuffer(incomeStatementFile), mimeType: incomeStatementFile.type || "application/pdf" },
      { data: await fileToBuffer(taxAdjustmentFile), mimeType: taxAdjustmentFile.type || "application/pdf" },
    );
    return NextResponse.json(analysis);
  } catch (error) {
    const message = error instanceof Error ? error.message : "문서 분석 중 오류가 발생했습니다.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
