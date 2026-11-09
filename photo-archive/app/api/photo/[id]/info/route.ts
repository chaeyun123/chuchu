import { NextResponse } from "next/server";
import { hasUploadAccess } from "@/lib/auth";
import { getArchivedPhotoMeta, listAlbums, updateGameInfo, type GameInfo } from "@/lib/drive";

/** PATCH /api/photo/<id>/info  { date, opponent, result }  — 업로드 권한이 있어야 수정 가능 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasUploadAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const meta = await getArchivedPhotoMeta(id);
  if (!meta) return NextResponse.json({ error: "사진을 찾을 수 없습니다" }, { status: 404 });

  const albums = await listAlbums();
  const albumId = meta.parents?.find((p) => albums.some((a) => a.id === p));
  if (!albumId) return NextResponse.json({ error: "사진을 찾을 수 없습니다" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const { date, opponent, result } = b ?? {};

  if (date != null && date !== "" && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다" }, { status: 400 });
  }
  if (opponent != null && typeof opponent !== "string") {
    return NextResponse.json({ error: "상대팀이 올바르지 않습니다" }, { status: 400 });
  }
  if (result != null && result !== "" && result !== "win" && result !== "lose") {
    return NextResponse.json({ error: "승패 값이 올바르지 않습니다" }, { status: 400 });
  }

  const game: GameInfo = {
    date: date || undefined,
    opponent: (opponent as string | undefined)?.normalize("NFC").trim().slice(0, 30) || undefined,
    result: result || undefined,
  };
  await updateGameInfo(id, albumId, game);
  return NextResponse.json({ game });
}
