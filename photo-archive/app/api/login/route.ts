import { NextResponse, after } from "next/server";
import { env } from "@/lib/env";
import { safeEqual, VIEW_COOKIE, viewCookieValue, cookieOptions } from "@/lib/auth";
import { logAccess } from "@/lib/accessLog";

// 사이트 입장 로그인 (아이디 + 비밀번호)
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const ok = safeEqual(id, env.siteId) && safeEqual(password, env.sitePassword);

  // 기록은 응답을 보낸 뒤에 저장 (로그인이 느려지지 않도록)
  after(() => logAccess(req.headers, ok ? "로그인 성공" : "로그인 실패", { id }));

  if (!ok) {
    await new Promise((r) => setTimeout(r, 800)); // 무차별 대입 완화
    return NextResponse.json({ error: "아이디 또는 비밀번호가 틀렸습니다" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(VIEW_COOKIE, viewCookieValue(), cookieOptions);
  return res;
}
