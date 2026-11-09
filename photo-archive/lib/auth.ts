import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

export const VIEW_COOKIE = "pa_view";
export const UPLOAD_COOKIE = "pa_upload";
// 브라우저가 허용하는 최대치(약 400일). 공유 링크를 다시 열면 언제든 갱신됩니다.
export const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function sign(kind: "view" | "upload"): string {
  // 토큰/비밀번호가 바뀌면 기존 쿠키는 자동으로 무효가 됩니다.
  const secret = kind === "view" ? env.siteToken : env.uploadPassword;
  return crypto
    .createHmac("sha256", env.cookieSecret)
    .update(`${kind}:${secret}`)
    .digest("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export const viewCookieValue = () => sign("view");
export const uploadCookieValue = () => sign("upload");

export async function hasViewAccess(): Promise<boolean> {
  const v = (await cookies()).get(VIEW_COOKIE)?.value;
  return !!v && safeEqual(v, sign("view"));
}

export async function hasUploadAccess(): Promise<boolean> {
  const v = (await cookies()).get(UPLOAD_COOKIE)?.value;
  return !!v && safeEqual(v, sign("upload")) && (await hasViewAccess());
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

export const RESERVED_NAMES = new Set([
  "api", "s", "upload", "_next", "favicon.ico", "robots.txt",
]);
