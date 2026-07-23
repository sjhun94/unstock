import { NextRequest, NextResponse } from "next/server";
import { analyzeNetAssetDocuments } from "@/lib/gemini";

export const maxDuration = 60;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "text/plain",
]);

const UNSUPPORTED_FILE_MESSAGE =
  "지원하지 않는 파일 형식이에요. PDF 또는 이미지(사진, 스캔본) 파일만 업로드할 수 있어요. 엑셀·워드 파일이라면 PDF로 변환하거나 화면을 캡처해서 올려주세요.";

async function fileToBuffer(file: File) {
  return Buffer.from(await file.arrayBuffer());
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const balanceSheetFile = formData.get("balanceSheet");
  const reserveScheduleFile = formData.get("reserveSchedule");

  if (!(balanceSheetFile instanceof File) || !(reserveScheduleFile instanceof File)) {
    return NextResponse.json(
      { error: "재무상태표와 자본금과 적립금조정명세서(을) 파일을 모두 첨부해주세요." },
      { status: 400 },
    );
  }

  if (!ALLOWED_MIME_TYPES.has(balanceSheetFile.type) || !ALLOWED_MIME_TYPES.has(reserveScheduleFile.type)) {
    return NextResponse.json({ error: UNSUPPORTED_FILE_MESSAGE }, { status: 400 });
  }

  try {
    const analysis = await analyzeNetAssetDocuments(
      { data: await fileToBuffer(balanceSheetFile), mimeType: balanceSheetFile.type },
      { data: await fileToBuffer(reserveScheduleFile), mimeType: reserveScheduleFile.type },
    );
    return NextResponse.json(analysis);
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "";
    const message = rawMessage.includes("Unsupported MIME type")
      ? UNSUPPORTED_FILE_MESSAGE
      : rawMessage || "문서 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
