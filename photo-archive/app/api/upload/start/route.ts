import { NextResponse } from "next/server";
import { hasEditAccess } from "@/lib/auth";
import { getAlbumById, startUpload } from "@/lib/drive";

const MAX_SIZE = 200 * 1024 * 1024; // 200MB

export async function POST(req: Request) {
  if (!(await hasEditAccess())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const { albumId, name, mimeType, size, caption, uploader } = b ?? {};

  if (typeof albumId !== "string" || !(await getAlbumById(albumId))) {
    return NextResponse.json({ error: "앨범을 찾을 수 없습니다" }, { status: 400 });
  }
  if (typeof name !== "string" || !name || typeof mimeType !== "string" || !mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 올릴 수 있습니다" }, { status: 400 });
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_SIZE) {
    return NextResponse.json({ error: "파일 크기가 올바르지 않습니다 (최대 200MB)" }, { status: 400 });
  }

  const sessionUrl = await startUpload({
    albumId,
    name: name.normalize("NFC").slice(0, 200),
    mimeType,
    size,
    caption: typeof caption === "string" ? caption.trim() : undefined,
    uploader: typeof uploader === "string" ? uploader.trim() : undefined,
  });
  return NextResponse.json({ sessionUrl });
}
