import { NextResponse } from "next/server";
import { hasEditAccess } from "@/lib/auth";
import { isValidSessionUrl, uploadChunk } from "@/lib/drive";

// 브라우저 → (4MB 조각) → 이 라우트 → Google Drive 업로드 세션
// Vercel 요청 본문 한도(4.5MB)를 피하기 위해 조각으로 나눠 보냅니다.
export const maxDuration = 60;

export async function PUT(req: Request) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const session = url.searchParams.get("session") ?? "";
  const start = Number(url.searchParams.get("start"));
  const total = Number(url.searchParams.get("total"));

  if (!isValidSessionUrl(session) || !Number.isInteger(start) || !Number.isInteger(total) || start < 0 || total <= 0) {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }
  const chunk = Buffer.from(await req.arrayBuffer());
  if (chunk.length === 0 || start + chunk.length > total) {
    return NextResponse.json({ error: "잘못된 조각" }, { status: 400 });
  }
  try {
    return NextResponse.json(await uploadChunk(session, chunk, start, total));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
