import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { safeEqual, VIEW_COOKIE, viewCookieValue, cookieOptions } from "@/lib/auth";

// 공유 링크: https://내사이트/s/<SITE_TOKEN>
// 맞으면 열람 쿠키를 심고 홈(앨범 목록)으로 이동 → 이후 주소는 /앨범명 처럼 깔끔하게
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!safeEqual(token, env.siteToken)) {
    return new NextResponse("Not found", { status: 404 });
  }
  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(VIEW_COOKIE, viewCookieValue(), cookieOptions);
  return res;
}
