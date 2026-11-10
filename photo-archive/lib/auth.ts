import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

export const VIEW_COOKIE = "pa_view";
export const UPLOAD_COOKIE = "pa_upload";
export const ADMIN_COOKIE = "pa_admin";
// 브라우저가 허용하는 최대치(약 400일). 다시 로그인하면 갱신됩니다.
export const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

function sign(kind: "view" | "upload" | "admin"): string {
  // 아이디/비밀번호가 바뀌면 기존 쿠키는 자동으로 무효가 됩니다(모두 다시 로그인).
  const secret =
    kind === "view" ? `${env.siteId}:${env.sitePassword}` :
    kind === "upload" ? env.uploadPassword :
    env.adminPassword;
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
export const adminCookieValue = () => sign("admin");

export async function hasViewAccess(): Promise<boolean> {
  const v = (await cookies()).get(VIEW_COOKIE)?.value;
  return !!v && safeEqual(v, sign("view"));
}

export async function hasUploadAccess(): Promise<boolean> {
  const v = (await cookies()).get(UPLOAD_COOKIE)?.value;
  return !!v && safeEqual(v, sign("upload")) && (await hasViewAccess());
}

/** 관리자(접속 기록 보기) — ADMIN_PASSWORD를 아는 사람만 */
export async function hasAdminAccess(): Promise<boolean> {
  const v = (await cookies()).get(ADMIN_COOKIE)?.value;
  return !!v && safeEqual(v, sign("admin")) && (await hasViewAccess());
}

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: COOKIE_MAX_AGE,
};

/** 앨범 이름 정리·검사. 올바르면 정리된 이름, 아니면 null */
export function cleanAlbumName(raw: unknown): string | null {
  const name = typeof raw === "string" ? raw.trim().normalize("NFC") : "";
  if (!name || name.length > 100 || /[\/\\?#%]/.test(name) || RESERVED_NAMES.has(name.toLowerCase())) return null;
  return name;
}
export const ALBUM_NAME_ERROR =
  "앨범 이름은 1~100자이고 / \\ ? # % 와 예약어(api, upload, albums, calendar, picks 등)는 쓸 수 없습니다";

export const RESERVED_NAMES = new Set([
  "api", "s", "upload", "logs", "albums", "calendar", "picks", "_next", "favicon.ico", "robots.txt",
]);
