import { NextResponse } from "next/server";
import { hasViewAccess } from "@/lib/auth";
import { albumIdOf, getArchivedPhotoMeta, setPhotoLiked } from "@/lib/drive";

/** PUT /api/photo/<id>/like  { liked: boolean } — 로그인한 사람 누구나 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasViewAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const meta = await getArchivedPhotoMeta(id);
  const albumId = meta && (await albumIdOf(meta));
  if (!meta || !albumId) return NextResponse.json({ error: "사진을 찾을 수 없습니다" }, { status: 404 });
  const { liked } = await req.json().catch(() => ({}));
  if (typeof liked !== "boolean") return NextResponse.json({ error: "잘못된 요청" }, { status: 400 });
  await setPhotoLiked(id, albumId, liked);
  return NextResponse.json({ liked });
}
