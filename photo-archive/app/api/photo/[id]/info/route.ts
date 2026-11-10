import { NextResponse } from "next/server";
import { hasUploadAccess } from "@/lib/auth";
import { albumIdOf, getArchivedPhotoMeta, updatePhotoInfo, type GameInfo } from "@/lib/drive";
import { isTeam } from "@/lib/teams";

/** PATCH /api/photo/<id>/info  { caption, date, opponent, result, uniform }  — 업로드 권한이 있어야 수정 가능 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await hasUploadAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const meta = await getArchivedPhotoMeta(id);
  const albumId = meta && (await albumIdOf(meta));
  if (!meta || !albumId) return NextResponse.json({ error: "사진을 찾을 수 없습니다" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const { caption, date, opponent, result, uniform } = b ?? {};

  if (caption != null && typeof caption !== "string") {
    return NextResponse.json({ error: "설명이 올바르지 않습니다" }, { status: 400 });
  }
  if (date != null && date !== "" && (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
    return NextResponse.json({ error: "날짜 형식이 올바르지 않습니다" }, { status: 400 });
  }
  if (opponent != null && opponent !== "" && !isTeam(opponent)) {
    return NextResponse.json({ error: "상대팀이 올바르지 않습니다" }, { status: 400 });
  }
  if (uniform != null && (typeof uniform !== "string" || uniform.length > 20)) {
    return NextResponse.json({ error: "유니폼은 20자까지 쓸 수 있습니다" }, { status: 400 });
  }
  if (result != null && result !== "" && result !== "win" && result !== "lose") {
    return NextResponse.json({ error: "승패 값이 올바르지 않습니다" }, { status: 400 });
  }

  const game: GameInfo = {
    date: date || undefined,
    opponent: opponent || undefined,
    result: result || undefined,
    uniform: (uniform as string | undefined)?.normalize("NFC").trim() || undefined,
  };
  const cleanCaption = (caption as string | undefined)?.normalize("NFC").trim() || undefined;
  await updatePhotoInfo(id, albumId, { caption: cleanCaption, game });
  return NextResponse.json({ caption: cleanCaption, game });
}
