import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { ADMIN_COOKIE, adminCookieValue, cookieOptions, hasViewAccess, safeEqual } from "@/lib/auth";

// 접속 기록 보기용 관리자 로그인
export async function POST(req: Request) {
  if (!(await hasViewAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { password } = await req.json().catch(() => ({ password: "" }));
  if (typeof password !== "string" || !safeEqual(password, env.adminPassword)) {
    await new Promise((r) => setTimeout(r, 800)); // 무차별 대입 완화
    return NextResponse.json({ error: "비밀번호가 틀렸습니다" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminCookieValue(), cookieOptions);
  return res;
}
