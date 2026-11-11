import { NextResponse } from "next/server";
import { ALBUM_NAME_ERROR, cleanAlbumName, hasEditAccess } from "@/lib/auth";
import { getAlbumById, listAlbums, renameAlbum, trashAlbum } from "@/lib/drive";

/** PATCH /api/albums/<id>  { name } — 앨범 이름 바꾸기. 업로드 권한 필요 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (!(await getAlbumById(id))) return NextResponse.json({ error: "앨범을 찾을 수 없습니다" }, { status: 404 });
  const name = cleanAlbumName((await req.json().catch(() => ({}))).name);
  if (!name) return NextResponse.json({ error: ALBUM_NAME_ERROR }, { status: 400 });
  // 이름이 곧 주소라서 같은 이름의 앨범이 두 개면 안 됨
  if ((await listAlbums()).some((a) => a.name === name && a.id !== id)) {
    return NextResponse.json({ error: "같은 이름의 앨범이 이미 있어요" }, { status: 409 });
  }
  await renameAlbum(id, name);
  return NextResponse.json({ id, name });
}

/** DELETE /api/albums/<id> — 앨범(폴더)째 드라이브 휴지통으로. 업로드 권한 필요 */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  if (!(await getAlbumById(id))) return NextResponse.json({ error: "앨범을 찾을 수 없습니다" }, { status: 404 });
  await trashAlbum(id);
  return NextResponse.json({ ok: true });
}
