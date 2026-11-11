import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { LOG_COOKIE, logCookieValue, cookieOptions, hasEditAccess, safeEqual } from "@/lib/auth";

// 접속 기록 보기용 확인 (admin 계정으로 로그인한 상태에서 ADMIN_PASSWORD 입력)
export async function POST(req: Request) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "관리자 계정만 볼 수 있어요" }, { status: 403 });
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !safeEqual(password, env.adminPassword)) {
    await new Promise((r) => setTimeout(r, 800)); // 무차별 대입 완화
    return NextResponse.json({ error: "비밀번호가 틀렸습니다" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(LOG_COOKIE, logCookieValue(), cookieOptions);
  return res;
}
