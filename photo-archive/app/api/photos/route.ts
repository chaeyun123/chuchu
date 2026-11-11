import { NextResponse } from "next/server";
import { hasEditAccess } from "@/lib/auth";
import { albumIdOf, getAlbumById, getArchivedPhotoMeta, movePhoto, trashPhoto } from "@/lib/drive";
import { clearThumbs } from "@/lib/thumbs";

export const maxDuration = 60;

/**
 * POST /api/photos  — 여러 장 한 번에 처리 (업로드 권한 필요)
 *   { action: "delete", ids: [...] }
 *   { action: "move",   ids: [...], to: "<앨범 id>" }
 */
export async function POST(req: Request) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { action, ids, to } = await req.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200 || !ids.every((i) => typeof i === "string")) {
    return NextResponse.json({ error: "사진을 선택해 주세요" }, { status: 400 });
  }
  if (action === "move" && (typeof to !== "string" || !(await getAlbumById(to)))) {
    return NextResponse.json({ error: "옮길 앨범을 찾을 수 없습니다" }, { status: 400 });
  }
  if (action !== "move" && action !== "delete") {
    return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  }

  const done: string[] = [];
  // 대표 사진 갱신이 엉키지 않도록 한 장씩 차례로 처리
  for (const id of ids as string[]) {
    const meta = await getArchivedPhotoMeta(id);
    const albumId = meta && (await albumIdOf(meta));
    if (!meta || !albumId) continue;
    try {
      if (action === "delete") {
        await trashPhoto(id, albumId);
        await clearThumbs(id);
      } else {
        await movePhoto(id, albumId, to);
      }
      done.push(id);
    } catch (e) {
      console.error(`[photos:${action}]`, id, e);
    }
  }
  return NextResponse.json({ done, failed: ids.length - done.length });
}
