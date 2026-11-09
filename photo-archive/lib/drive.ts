import "server-only";
import { OAuth2Client } from "google-auth-library";
import { env } from "./env";

/**
 * Google Drive = DB
 *   루트 폴더 (DRIVE_ROOT_FOLDER_ID)
 *     └ 앨범 폴더 (폴더명 = 앨범명 = URL)    appProperties: { cover }
 *         └ 사진 파일 (원본 그대로)          appProperties: { caption, uploader }
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
  name: string;
  mimeType: string;
  size: number;
  createdTime: string;
  takenAt?: string;
  width?: number;
  height?: number;
  caption?: string;
  uploader?: string;
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
      imageMediaMetadata?: { width?: number; height?: number; time?: string; rotation?: number };
      appProperties?: Record<string, string>;
    };
    const raw = await listAll<Raw>(
      `'${q(albumId)}' in parents and mimeType contains 'image/' and trashed=false`,
      "id,name,mimeType,size,createdTime,imageMediaMetadata(width,height,time,rotation),appProperties",
    );
    const photos = raw.map((f): Photo => {
      const m = f.imageMediaMetadata;
      // 회전 정보(90/270도)가 있으면 가로·세로를 바꿔서 레이아웃이 맞도록
      const swap = m?.rotation === 1 || m?.rotation === 3;
      return {
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: Number(f.size ?? 0),
        createdTime: f.createdTime,
        takenAt: exifToIso(m?.time),
        width: swap ? m?.height : m?.width,
        height: swap ? m?.width : m?.height,
        caption: f.appProperties?.caption,
        uploader: f.appProperties?.uploader,
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

type FileMeta = { id: string; name: string; mimeType: string; parents?: string[]; size?: string };

/** 파일이 아카이브(루트 → 앨범 → 사진) 안에 있는 이미지인지 확인 */
export async function getArchivedPhotoMeta(fileId: string): Promise<FileMeta | null> {
  if (!/^[\w-]{10,}$/.test(fileId)) return null;
  return cached(`meta:${fileId}`, async () => {
    try {
      const meta: FileMeta = await (
        await drive(`/files/${fileId}?fields=id,name,mimeType,parents,size,trashed`)
      ).json();
      if (!meta.mimeType.startsWith("image/")) return null;
      const albums = await listAlbums();
      const ok = meta.parents?.some((p) => albums.some((a) => a.id === p));
      return ok ? meta : null;
    } catch {
      return null;
    }
  });
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
