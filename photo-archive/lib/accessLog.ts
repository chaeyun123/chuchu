import "server-only";
import { appendAccessLog } from "./drive";

export type LogKind = "로그인 성공" | "로그인 실패" | "방문";

function decode(s: string | null): string {
  if (!s) return "";
  try { return decodeURIComponent(s); } catch { return s; }
}

/** User-Agent를 "iPhone · Safari" 처럼 짧게 */
export function shortDevice(ua: string): string {
  const os =
    /iPhone/.test(ua) ? "iPhone" :
    /iPad/.test(ua) ? "iPad" :
    /Android/.test(ua) ? "Android" :
    /Windows/.test(ua) ? "Windows" :
    /Mac OS X|Macintosh/.test(ua) ? "Mac" :
    /Linux/.test(ua) ? "Linux" : "기타";
  const browser =
    /KAKAOTALK/i.test(ua) ? "카카오톡" :
    /NAVER/.test(ua) ? "네이버" :
    /Instagram/.test(ua) ? "인스타그램" :
    /SamsungBrowser/.test(ua) ? "삼성 인터넷" :
    /Edg\//.test(ua) ? "Edge" :
    /Whale/.test(ua) ? "Whale" :
    /CriOS|Chrome\//.test(ua) ? "Chrome" :
    /FxiOS|Firefox\//.test(ua) ? "Firefox" :
    /Safari\//.test(ua) ? "Safari" : "";
  return browser ? `${os} · ${browser}` : os;
}

/** 요청 헤더에서 IP·위치·기기를 뽑아 접속 기록에 한 줄 남깁니다. 실패해도 사이트 동작에는 영향 없음. */
export async function logAccess(headers: Headers, kind: LogKind, opts: { id?: string; page?: string } = {}) {
  const ua = headers.get("user-agent") ?? "";
  const ip = (headers.get("x-forwarded-for") ?? headers.get("x-real-ip") ?? "").split(",")[0].trim();
  // Vercel이 붙여 주는 위치 헤더 (로컬에서는 비어 있음)
  const place = [decode(headers.get("x-vercel-ip-city")), decode(headers.get("x-vercel-ip-country"))]
    .filter(Boolean)
    .join(", ");
  const time = new Date().toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }); // 2026-11-10 14:03:22
  try {
    await appendAccessLog([
      time,
      kind,
      (opts.id ?? "").slice(0, 50),
      (opts.page ?? "").slice(0, 200),
      ip,
      place,
      shortDevice(ua),
      ua.slice(0, 300),
    ]);
  } catch (e) {
    console.error("[access-log]", e);
  }
}
