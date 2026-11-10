import { NextResponse } from "next/server";
import { hasUploadAccess, RESERVED_NAMES } from "@/lib/auth";
import { createAlbum, listAlbums } from "@/lib/drive";

export async function GET() {
  if (!(await hasUploadAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await listAlbums());
}

export async function POST(req: Request) {
  if (!(await hasUploadAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().normalize("NFC") : "";
  if (!name || name.length > 100 || /[\/\\?#%]/.test(name) || RESERVED_NAMES.has(name.toLowerCase())) {
    return NextResponse.json(
      { error: "앨범 이름은 1~100자이고 / \\ ? # % 와 예약어(api, upload, albums, calendar, picks 등)는 쓸 수 없습니다" },
      { status: 400 },
    );
  }
  const existing = (await listAlbums()).find((a) => a.name === name);
  if (existing) return NextResponse.json(existing);
  return NextResponse.json(await createAlbum(name));
}
