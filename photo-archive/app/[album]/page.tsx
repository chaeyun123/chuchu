import Link from "next/link";
import { notFound } from "next/navigation";
import { hasEditAccess, hasViewAccess } from "@/lib/auth";
import { getAlbumByName, invalidate, listAlbums, listPhotos } from "@/lib/drive";
import Locked from "@/components/Locked";
import Gallery from "@/components/Gallery";
import AlbumDelete from "@/components/AlbumDelete";
import AlbumTitle from "@/components/AlbumTitle";

export const dynamic = "force-dynamic";

function decode(s: string) {
  try { return decodeURIComponent(s).normalize("NFC"); } catch { return s.normalize("NFC"); }
}

export default async function AlbumPage({
  params,
  searchParams,
}: {
  params: Promise<{ album: string }>;
  searchParams: Promise<{ id?: string }>;
}) {
  if (!(await hasViewAccess())) return <Locked />;
  const name = decode((await params).album);
  // ?id= : 방금 만들거나 이름 바꾼 앨범 (다른 서버 캐시에 아직 없을 수 있어 직접 확인)
  const { id: justChanged } = await searchParams;
  const album = await getAlbumByName(name, justChanged);
  if (!album) notFound();
  // 방금 업로드/생성 직후라면 이 서버의 사진 목록 캐시를 버리고 새로 받기
  if (justChanged) invalidate(`photos:${album.id}`);
  const [photos, albums, canEdit] = await Promise.all([listPhotos(album.id), listAlbums(), hasEditAccess()]);

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <Link href="/albums" className="back">← 앨범 목록</Link>
          <AlbumTitle key={album.id + album.name} id={album.id} name={album.name} canEdit={canEdit} />
          <p className="muted">사진 {photos.length}장</p>
        </div>
        <div className="top-actions">
          {canEdit && <AlbumDelete id={album.id} name={album.name} count={photos.length} />}
          {canEdit && <Link href={`/upload?album=${encodeURIComponent(album.name)}`} className="btn">이 앨범에 올리기</Link>}
        </div>
      </header>
      {photos.length === 0 ? (
        <p className="muted empty">아직 사진이 없습니다.</p>
      ) : (
        <Gallery
          photos={photos}
          canEdit={canEdit}
          albumId={album.id}
          selectable
          defaultSort="taken-asc"
          sortKey="album"
          albums={albums.map((a) => ({ id: a.id, name: a.name }))}
        />
      )}
    </main>
  );
}
