import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { env } from "./env";

export const VIEW_COOKIE = "pa_view";
export const LOG_COOKIE = "pa_admin";
// 브라우저가 허용하는 최대치(약 400일). 다시 로그인하면 갱신됩니다.
export const COOKIE_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * 계정 두 종류
 *   admin (SITE_ID / SITE_PASSWORD) : 보기 + 업로드·수정·삭제·이동·앨범 관리
 *   user  (USER_ID / USER_PASSWORD) : 보기 + 정원pick!(좋아요)만
 */
export type Role = "admin" | "user";

function account(role: Role): { id: string; password: string } | null {
  if (role === "admin") return { id: env.siteId, password: env.sitePassword };
  const id = process.env.USER_ID;
  const password = process.env.USER_PASSWORD;
  return id && password ? { id, password } : null; // 설정 안 하면 user 계정은 꺼짐
}

function sign(data: string): string {
  return crypto.createHmac("sha256", env.cookieSecret).update(data).digest("base64url");
}

/** 쿠키 = "<role>.<서명>". 아이디/비밀번호가 바뀌면 그 계정의 기존 로그인은 자동으로 풀립니다. */
function roleSignature(role: Role): string | null {
  const acc = account(role);
  return acc ? sign(`view:${role}:${acc.id}:${acc.password}`) : null;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/** 아이디/비밀번호가 맞는 계정 종류 (없으면 null) */
export function matchAccount(id: string, password: string): Role | null {
  for (const role of ["admin", "user"] as const) {
    const acc = account(role);
    // 두 값을 모두 비교해서 응답 시간으로 아이디만 맞았는지 알 수 없게
    if (!acc) continue;
    const idOk = safeEqual(id, acc.id);
    const pwOk = safeEqual(password, acc.password);
    if (idOk && pwOk) return role;
  }
  return null;
}

export const viewCookieValue = (role: Role) => `${role}.${roleSignature(role)}`;

/** 현재 로그인한 계정 종류 (로그인 안 했으면 null) */
export async function getRole(): Promise<Role | null> {
  const v = (await cookies()).get(VIEW_COOKIE)?.value ?? "";
  const [role, sig] = v.split(".");
  if (role !== "admin" && role !== "user") return null;
  const expected = roleSignature(role);
  return expected && sig && safeEqual(sig, expected) ? role : null;
}

export async function hasViewAccess(): Promise<boolean> {
  return (await getRole()) !== null;
}

/** 업로드·수정·삭제·이동·앨범 관리 — admin 계정만 */
export async function hasEditAccess(): Promise<boolean> {
  return (await getRole()) === "admin";
}

const logSignature = () => sign(`log:${env.adminPassword}`);
export const logCookieValue = logSignature;

/** 접속 기록 보기 — admin 계정 + ADMIN_PASSWORD 확인까지 한 사람만 */
export async function hasLogAccess(): Promise<boolean> {
  const v = (await cookies()).get(LOG_COOKIE)?.value;
  return !!v && safeEqual(v, logSignature()) && (await hasEditAccess());
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
