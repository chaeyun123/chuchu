import Link from "next/link";
import { notFound } from "next/navigation";
import { hasUploadAccess, hasViewAccess } from "@/lib/auth";
import { getAlbumByName, listPhotos } from "@/lib/drive";
import Locked from "@/components/Locked";
import Gallery from "@/components/Gallery";

export const dynamic = "force-dynamic";

function decode(s: string) {
  try { return decodeURIComponent(s).normalize("NFC"); } catch { return s.normalize("NFC"); }
}

export default async function AlbumPage({ params }: { params: Promise<{ album: string }> }) {
  if (!(await hasViewAccess())) return <Locked />;
  const name = decode((await params).album);
  const album = await getAlbumByName(name);
  if (!album) notFound();
  const photos = await listPhotos(album.id);

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <Link href="/" className="back">← 앨범 목록</Link>
          <h1>{album.name}</h1>
          <p className="muted">사진 {photos.length}장</p>
        </div>
        <Link href={`/upload?album=${encodeURIComponent(album.name)}`} className="btn">이 앨범에 올리기</Link>
      </header>
      {photos.length === 0 ? (
        <p className="muted empty">아직 사진이 없습니다.</p>
      ) : (
        <Gallery photos={photos} canEdit={await hasUploadAccess()} />
      )}
    </main>
  );
}
