import "server-only";
import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

/**
 * Google Drive = DB
 *   루트 폴더 (DRIVE_ROOT_FOLDER_ID)
 *     └ 앨범 폴더 (폴더명 = 앨범명 = URL)    appProperties: { cover }
 *         └ 사진 파일 (원본 그대로)          appProperties: { caption, uploader, gameDate, opponent, result, uniform, liked }
 *                                           + 드라이브가 자동 추출한 imageMediaMetadata
 */

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3/files";
const FOLDER_MIME = "application/vnd.google-apps.folder";

export type Album = {
  id: string;
  name: string;
  createdTime: string;
  cover?: string;
};

export type Photo = {
  id: string;
  albumId: string;
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  takenAt?: string;
  width?: number;
  height?: number;
  caption?: string;
  uploader?: string;
  device?: DeviceInfo;
  game: GameInfo;
  liked: boolean; // 정원pick!
};

/** 드라이브가 EXIF에서 뽑아준 촬영 장치 정보 */
export type DeviceInfo = {
  make?: string;
  model?: string;
  lens?: string;
  focalLength?: number; // mm
  aperture?: number; // f값
  exposureTime?: number; // 초
  iso?: number;
};

/** 직접 입력하는 경기 정보 */
export type GameResult = "win" | "lose";
export type GameInfo = {
  date?: string; // YYYY-MM-DD
  opponent?: string; // NC vs (opponent)
  uniform?: string; // 유니폼 종류 (홈, 원정 등 자유 입력)
  result?: GameResult;
};

// ── 인증 ──────────────────────────────────────────────
let client: OAuth2Client | null = null;
async function accessToken(): Promise<string> {
  if (!client) {
    client = new OAuth2Client(env.clientId, env.clientSecret);
    client.setCredentials({ refresh_token: env.refreshToken });
  }
  const { token } = await client.getAccessToken();
  if (!token) throw new Error("Google access token 발급 실패");
  return token;
}

async function drive(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Drive API ${res.status}: ${await res.text()}`);
  return res;
}

const q = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

async function listAll<T>(query: string, fields: string, orderBy?: string): Promise<T[]> {
  const out: T[] = [];
  let pageToken: string | undefined;
  do {
    const p = new URLSearchParams({
      q: query,
      fields: `nextPageToken, files(${fields})`,
      pageSize: "1000",
      spaces: "drive",
    });
    if (orderBy) p.set("orderBy", orderBy);
    if (pageToken) p.set("pageToken", pageToken);
    const data = await (await drive(`/files?${p}`)).json();
    out.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

// ── 간단한 메모리 캐시 (드라이브 호출 최소화) ──────────────
const TTL = 60_000;
const cache = new Map<string, { at: number; value: unknown }>();
async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as T;
  const value = await fn();
  cache.set(key, { at: Date.now(), value });
  return value;
}
export function invalidate(...keys: string[]) {
  for (const k of keys) cache.delete(k);
}

// ── 앨범 ──────────────────────────────────────────────
export function listAlbums(): Promise<Album[]> {
  return cached("albums", async () => {
    type Raw = { id: string; name: string; createdTime: string; appProperties?: Record<string, string> };
    const raw = await listAll<Raw>(
      `'${q(env.rootFolderId)}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`,
      "id,name,createdTime,appProperties",
      "createdTime desc",
    );
    return raw.map((f) => ({
      id: f.id,
      name: f.name,
      createdTime: f.createdTime,
      cover: f.appProperties?.cover,
    }));
  });
}

export async function getAlbumByName(name: string): Promise<Album | undefined> {
  return (await listAlbums()).find((a) => a.name === name);
}

export async function getAlbumById(id: string): Promise<Album | undefined> {
  return (await listAlbums()).find((a) => a.id === id);
}

export async function createAlbum(name: string): Promise<Album> {
  const res = await drive(`/files?fields=id,name,createdTime`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [env.rootFolderId] }),
  });
  invalidate("albums");
  return res.json();
}

async function setAlbumCoverIfEmpty(albumId: string, photoId: string) {
  const album = await getAlbumById(albumId);
  if (!album || album.cover) return;
  await drive(`/files/${albumId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties: { cover: photoId } }),
  });
  invalidate("albums");
}

// ── 사진 ──────────────────────────────────────────────
export function listPhotos(albumId: string): Promise<Photo[]> {
  return cached(`photos:${albumId}`, async () => {
    type Raw = {
      id: string; name: string; mimeType: string; size?: string; createdTime: string;
      imageMediaMetadata?: {
        width?: number; height?: number; time?: string; rotation?: number;
        cameraMake?: string; cameraModel?: string; lens?: string;
        focalLength?: number; aperture?: number; exposureTime?: number; isoSpeed?: number;
      };
      appProperties?: Record<string, string>;
    };
    const raw = await listAll<Raw>(
      `'${q(albumId)}' in parents and mimeType contains 'image/' and trashed=false`,
      "id,name,mimeType,size,createdTime,appProperties," +
        "imageMediaMetadata(width,height,time,rotation,cameraMake,cameraModel,lens,focalLength,aperture,exposureTime,isoSpeed)",
    );
    const photos = raw.map((f): Photo => {
      const m = f.imageMediaMetadata;
      // 회전 정보(90/270도)가 있으면 가로·세로를 바꿔서 레이아웃이 맞도록
      const swap = m?.rotation === 1 || m?.rotation === 3;
      const ap = f.appProperties ?? {};
      const device: DeviceInfo = {
        make: m?.cameraMake?.trim() || undefined,
        model: m?.cameraModel?.trim() || undefined,
        lens: m?.lens?.trim() || undefined,
        focalLength: m?.focalLength || undefined,
        aperture: m?.aperture || undefined,
        exposureTime: m?.exposureTime || undefined,
        iso: m?.isoSpeed || undefined,
      };
      return {
        id: f.id,
        albumId,
        name: f.name,
        mimeType: f.mimeType,
        size: Number(f.size ?? 0),
        createdTime: f.createdTime,
        takenAt: exifToIso(m?.time),
        width: swap ? m?.height : m?.width,
        height: swap ? m?.width : m?.height,
        caption: f.appProperties?.caption,
        uploader: f.appProperties?.uploader,
        device: Object.values(device).some((v) => v !== undefined) ? device : undefined,
        game: {
          date: ap.gameDate || undefined,
          opponent: ap.opponent || undefined,
          uniform: ap.uniform || undefined,
          result: ap.result === "win" || ap.result === "lose" ? ap.result : undefined,
        },
        liked: ap.liked === "1",
      };
    });
    // 촬영일 기준 정렬 (없으면 업로드일)
    return photos.sort((a, b) =>
      (a.takenAt ?? a.createdTime).localeCompare(b.takenAt ?? b.createdTime),
    );
  });
}

function exifToIso(t?: string): string | undefined {
  // "2024:05:01 12:34:56" → "2024-05-01T12:34:56"
  const m = t?.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined;
}

type FileMeta = { id: string; name: string; mimeType: string; parents?: string[]; size?: string; trashed?: boolean };

/** 파일이 아카이브(루트 → 앨범 → 사진) 안에 있는 이미지인지 확인 */
export async function getArchivedPhotoMeta(fileId: string): Promise<FileMeta | null> {
  if (!/^[\w-]{10,}$/.test(fileId)) return null;
  return cached(`meta:${fileId}`, async () => {
    try {
      const meta: FileMeta = await (
        await drive(`/files/${fileId}?fields=id,name,mimeType,parents,size,trashed`)
      ).json();
      if (meta.trashed || !meta.mimeType.startsWith("image/")) return null;
      const albums = await listAlbums();
      const ok = meta.parents?.some((p) => albums.some((a) => a.id === p));
      return ok ? meta : null;
    } catch {
      return null;
    }
  });
}

/** 설명·경기 정보 수정. 빈 값은 삭제(null)로 처리합니다. */
export async function updatePhotoInfo(
  fileId: string,
  albumId: string,
  info: { caption?: string; game: GameInfo },
): Promise<void> {
  await drive(`/files/${fileId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      appProperties: {
        caption: info.caption ? clipBytes(info.caption, 110) : null,
        gameDate: info.game.date || null,
        opponent: info.game.opponent ? clipBytes(info.game.opponent, 100) : null,
        uniform: info.game.uniform ? clipBytes(info.game.uniform, 100) : null,
        result: info.game.result || null,
      },
    }),
  });
  invalidate(`photos:${albumId}`);
}

/** 사진 삭제 = 드라이브 휴지통으로 이동 (30일 안에 드라이브에서 복구 가능) */
export async function trashPhoto(fileId: string, albumId: string): Promise<void> {
  await drive(`/files/${fileId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  invalidate(`photos:${albumId}`, `meta:${fileId}`);
  await replaceCoverIfRemoved(albumId, fileId);
}

/** 대표 사진이 앨범에서 빠졌으면 남은 사진 중 첫 장으로 교체 */
async function replaceCoverIfRemoved(albumId: string, fileId: string) {
  const album = await getAlbumById(albumId);
  if (album?.cover !== fileId) return;
  const next = (await listPhotos(albumId))[0]?.id ?? null;
  await drive(`/files/${albumId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties: { cover: next } }),
  });
  invalidate("albums");
}

/** 사진을 다른 앨범(폴더)으로 이동 */
export async function movePhoto(fileId: string, fromAlbumId: string, toAlbumId: string): Promise<void> {
  if (fromAlbumId === toAlbumId) return;
  const p = new URLSearchParams({ addParents: toAlbumId, removeParents: fromAlbumId, fields: "id" });
  await drive(`/files/${fileId}?${p}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  invalidate(`photos:${fromAlbumId}`, `photos:${toAlbumId}`, `meta:${fileId}`);
  await replaceCoverIfRemoved(fromAlbumId, fileId);
  await setAlbumCoverIfEmpty(toAlbumId, fileId);
}

/** 좋아요(정원pick!) 켜기/끄기 */
export async function setPhotoLiked(fileId: string, albumId: string, liked: boolean): Promise<void> {
  await drive(`/files/${fileId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appProperties: { liked: liked ? "1" : null } }),
  });
  invalidate(`photos:${albumId}`);
}

/** 앨범 삭제 = 폴더째 드라이브 휴지통으로 (30일 안에 복구 가능) */
export async function trashAlbum(albumId: string): Promise<void> {
  await drive(`/files/${albumId}?fields=id`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ trashed: true }),
  });
  invalidate("albums", `photos:${albumId}`);
}

/** 모든 앨범의 사진 (캘린더·정원pick!·홈에서 사용) */
export async function listAllPhotos(): Promise<Photo[]> {
  const albums = await listAlbums();
  return (await Promise.all(albums.map((a) => listPhotos(a.id)))).flat();
}

/** 캘린더에 쓸 사진 날짜: 직접 입력한 경기 날짜 → 촬영일 → 업로드일(한국 시간) */
export function photoDay(p: Photo): string {
  if (p.game.date) return p.game.date;
  if (p.takenAt) return p.takenAt.slice(0, 10);
  return new Date(p.createdTime).toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
}

/** 사진이 들어 있는 앨범 id (아카이브 밖이면 undefined) */
export async function albumIdOf(meta: FileMeta): Promise<string | undefined> {
  const albums = await listAlbums();
  return meta.parents?.find((p) => albums.some((a) => a.id === p));
}

export async function downloadFile(fileId: string): Promise<Response> {
  return drive(`/files/${fileId}?alt=media`);
}

// ── 업로드 (Resumable upload, 서버를 거쳐 4MB씩 전송) ─────────
export async function startUpload(opts: {
  albumId: string;
  name: string;
  mimeType: string;
  size: number;
  caption?: string;
  uploader?: string;
}): Promise<string> {
  const appProperties: Record<string, string> = {};
  // appProperties 값은 키+값 합쳐 124바이트 제한이 있어 잘라서 저장
  if (opts.caption) appProperties.caption = clipBytes(opts.caption, 110);
  if (opts.uploader) appProperties.uploader = clipBytes(opts.uploader, 100);

  const res = await fetch(`${UPLOAD_API}?uploadType=resumable&fields=id,name,parents`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": opts.mimeType,
      "X-Upload-Content-Length": String(opts.size),
    },
    body: JSON.stringify({ name: opts.name, parents: [opts.albumId], appProperties }),
  });
  if (!res.ok) throw new Error(`업로드 세션 생성 실패 ${res.status}: ${await res.text()}`);
  const location = res.headers.get("location");
  if (!location) throw new Error("업로드 세션 URL 없음");
  return location;
}

export function isValidSessionUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return (
      u.protocol === "https:" &&
      u.hostname === "www.googleapis.com" &&
      u.pathname === "/upload/drive/v3/files" &&
      u.searchParams.has("upload_id")
    );
  } catch {
    return false;
  }
}

export async function uploadChunk(
  sessionUrl: string,
  chunk: Buffer,
  start: number,
  total: number,
): Promise<{ done: false; next: number } | { done: true; id: string }> {
  const end = start + chunk.length - 1;
  const res = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
    body: new Uint8Array(chunk),
  });
  if (res.status === 308) {
    const range = res.headers.get("range"); // "bytes=0-4194303"
    const last = range ? Number(range.split("-")[1]) : -1;
    return { done: false, next: last + 1 };
  }
  if (!res.ok) throw new Error(`청크 업로드 실패 ${res.status}: ${await res.text()}`);
  const file: { id: string; parents?: string[] } = await res.json();
  const albumId = file.parents?.[0];
  if (albumId) {
    invalidate(`photos:${albumId}`);
    await setAlbumCoverIfEmpty(albumId, file.id).catch(() => {});
  }
  return { done: true, id: file.id };
}

function clipBytes(s: string, max: number): string {
  let out = "";
  for (const ch of s) {
    if (Buffer.byteLength(out + ch) > max) break;
    out += ch;
  }
  return out;
}

// ── 접속 기록 (루트 폴더의 CSV 파일 하나) ──────────────────
// 드라이브에서 바로 열어 볼 수 있고, /logs 페이지에서도 볼 수 있습니다.
const LOG_NAME = "접속기록.csv";
export const LOG_COLUMNS = ["시간(KST)", "구분", "아이디", "페이지", "IP", "위치", "기기", "User-Agent"];
let logFileId: string | null = null;
let logQueue: Promise<unknown> = Promise.resolve();

function csvCell(v: string): string {
  let s = v.replace(/[\r\n]+/g, " ");
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`; // 엑셀/시트에서 수식으로 실행되지 않도록
  return `"${s.replace(/"/g, '""')}"`;
}

async function logFile(create: boolean): Promise<string | null> {
  if (logFileId) return logFileId;
  const [found] = await listAll<{ id: string }>(
    `'${q(env.rootFolderId)}' in parents and name='${q(LOG_NAME)}' and trashed=false`,
    "id",
  );
  if (found) return (logFileId = found.id);
  if (!create) return null;
  const res = await drive(`/files?fields=id`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: LOG_NAME, mimeType: "text/csv", parents: [env.rootFolderId] }),
  });
  return (logFileId = (await res.json()).id as string);
}

async function readLogText(id: string): Promise<string> {
  return (await drive(`/files/${id}?alt=media`)).text();
}

/** 한 줄 추가. 같은 서버 안에서는 순서대로 처리해 기록이 덮어써지지 않게 합니다. */
export function appendAccessLog(row: string[]): Promise<void> {
  const run = logQueue.then(async () => {
    const id = (await logFile(true))!;
    let text = await readLogText(id);
    // BOM: 엑셀에서 한글이 깨지지 않도록
    if (!text) text = "﻿" + LOG_COLUMNS.map(csvCell).join(",") + "\n";
    text += row.map(csvCell).join(",") + "\n";
    const res = await fetch(`${UPLOAD_API}/${id}?uploadType=media&fields=id`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${await accessToken()}`, "Content-Type": "text/csv; charset=UTF-8" },
      body: text,
    });
    if (!res.ok) throw new Error(`접속 기록 저장 실패 ${res.status}: ${await res.text()}`);
  });
  logQueue = run.catch(() => {});
  return run;
}

/** 접속 기록 전체 (오래된 순). 헤더 줄은 빠집니다. */
export async function readAccessLog(): Promise<string[][]> {
  const id = await logFile(false);
  if (!id) return [];
  const lines = (await readLogText(id)).replace(/^﻿/, "").split("\n").filter(Boolean);
  return lines.slice(1).map((line) =>
    [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((m) => m[1].replace(/""/g, '"')),
  );
}
