import { NextResponse } from "next/server";
import { ALBUM_NAME_ERROR, cleanAlbumName, hasEditAccess } from "@/lib/auth";
import { createAlbum, invalidate, listAlbums } from "@/lib/drive";

export async function GET() {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  invalidate("albums"); // 업로드 화면용: 항상 최신 목록
  return NextResponse.json(await listAlbums());
}

export async function POST(req: Request) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = cleanAlbumName(body.name);
  if (!name) return NextResponse.json({ error: ALBUM_NAME_ERROR }, { status: 400 });
  const existing = (await listAlbums()).find((a) => a.name === name);
  if (existing) return NextResponse.json(existing);
  return NextResponse.json(await createAlbum(name));
}
