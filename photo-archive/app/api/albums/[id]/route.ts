import { NextResponse } from "next/server";
import { hasUploadAccess } from "@/lib/auth";
import { getAlbumById, trashAlbum } from "@/lib/drive";

/** DELETE /api/albums/<id> — 앨범(폴더)째 드라이브 휴지통으로. 업로드 권한 필요 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasUploadAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (!(await getAlbumById(id))) return NextResponse.json({ error: "앨범을 찾을 수 없습니다" }, { status: 404 });
  await trashAlbum(id);
  return NextResponse.json({ ok: true });
}
