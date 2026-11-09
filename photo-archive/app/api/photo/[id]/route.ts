import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { hasViewAccess } from "@/lib/auth";
import { downloadFile, getArchivedPhotoMeta } from "@/lib/drive";

export const maxDuration = 60;

const WIDTHS = [480, 1600] as const;
const CACHE_DIR = path.join(os.tmpdir(), "photo-archive-cache");

// 응답은 반드시 private 캐시만 허용합니다.
// (public 이면 CDN이 쿠키 검사 없이 사진을 내줄 수 있음)
const PRIVATE_CACHE = "private, max-age=31536000, immutable";

/**
 *  /api/photo/<id>?w=480      썸네일 (webp, EXIF·위치정보 제거됨)
 *  /api/photo/<id>?w=1600     크게 보기용
 *  /api/photo/<id>?download=1 원본 다운로드
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasViewAccess())) return new NextResponse("Forbidden", { status: 403 });
  const { id } = await params;
  const meta = await getArchivedPhotoMeta(id);
  if (!meta) return new NextResponse("Not found", { status: 404 });

  const url = new URL(req.url);

  // ── 원본 다운로드 ──
  if (url.searchParams.get("download")) {
    const file = await downloadFile(id);
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": meta.mimeType,
        ...(meta.size ? { "Content-Length": meta.size } : {}),
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        "Cache-Control": PRIVATE_CACHE,
      },
    });
  }

  // ── 리사이즈 버전 ──
  const requested = Number(url.searchParams.get("w")) || 480;
  const w = WIDTHS.find((x) => x >= requested) ?? WIDTHS[WIDTHS.length - 1];
  const cacheFile = path.join(CACHE_DIR, `${id}-${w}.webp`);

  let out: Buffer;
  try {
    out = await fs.readFile(cacheFile);
  } catch {
    const original = Buffer.from(await (await downloadFile(id)).arrayBuffer());
    try {
      out = await sharp(original, { failOn: "none" })
        .rotate() // EXIF 방향 반영
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: w > 1000 ? 85 : 75 })
        .toBuffer(); // sharp는 기본적으로 메타데이터(EXIF/GPS)를 제거합니다
    } catch {
      // 변환 불가 포맷(HEIC 등)은 원본을 그대로 전달
      return new NextResponse(new Uint8Array(original), {
        headers: { "Content-Type": meta.mimeType, "Cache-Control": PRIVATE_CACHE },
      });
    }
    await fs.mkdir(CACHE_DIR, { recursive: true }).catch(() => {});
    await fs.writeFile(cacheFile, out).catch(() => {});
  }

  return new NextResponse(new Uint8Array(out), {
    headers: { "Content-Type": "image/webp", "Cache-Control": PRIVATE_CACHE },
  });
}
