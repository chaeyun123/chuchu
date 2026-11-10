import Link from "next/link";
import { hasAdminAccess, hasUploadAccess, hasViewAccess } from "@/lib/auth";
import { listAlbums, listAllPhotos } from "@/lib/drive";
import Locked from "@/components/Locked";
import Gallery from "@/components/Gallery";

export const dynamic = "force-dynamic";

// 메인 = 모든 앨범의 사진 모아보기
export default async function Home() {
  if (!(await hasViewAccess())) return <Locked />;
  const [all, albums, canEdit, isAdmin] = await Promise.all([
    listAllPhotos(),
    listAlbums(),
    hasUploadAccess(),
    hasAdminAccess(),
  ]);

  return (
    <main className="wrap">
      <header className="top compact">
        <p className="muted">사진 {all.length}장 · 앨범 {albums.length}개</p>
        <div className="top-actions">
          {isAdmin && <Link href="/logs" className="btn ghost">접속 기록</Link>}
          <Link href="/upload" className="btn">사진 올리기</Link>
        </div>
      </header>
      {all.length === 0 ? (
        <p className="muted empty">아직 사진이 없습니다. ‘사진 올리기’에서 첫 사진을 올려 보세요.</p>
      ) : (
        <Gallery
          photos={all}
          canEdit={canEdit}
          albums={albums.map((a) => ({ id: a.id, name: a.name }))}
          defaultSort="upload-desc"
          sortKey="home"
        />
      )}
    </main>
  );
}
