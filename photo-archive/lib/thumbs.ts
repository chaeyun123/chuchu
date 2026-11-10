import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/** 썸네일 캐시 (서버 임시 폴더) */
export const WIDTHS = [480, 1600] as const;
export const CACHE_DIR = path.join(os.tmpdir(), "photo-archive-cache");

export async function clearThumbs(id: string) {
  await Promise.all(WIDTHS.map((w) => fs.unlink(path.join(CACHE_DIR, `${id}-${w}.webp`)).catch(() => {})));
}
