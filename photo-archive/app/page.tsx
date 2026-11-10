import Link from "next/link";
import { hasUploadAccess, hasViewAccess } from "@/lib/auth";
import { listAlbums, listAllPhotos } from "@/lib/drive";
import Locked from "@/components/Locked";
import Gallery from "@/components/Gallery";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasViewAccess())) return <Locked />;
  const [all, albums, isAdmin] = await Promise.all([listAllPhotos(), listAlbums(), hasUploadAccess()]);
  const albumRefs = albums.map((a) => ({ id: a.id, name: a.name }));
  const byNewest = [...all].sort((a, b) => b.createdTime.localeCompare(a.createdTime));
  const recent = byNewest.slice(0, 12);
  const picks = byNewest.filter((p) => p.liked).slice(0, 8);

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>정원!!</h1>
          <p className="muted">앨범 {albums.length}개 · 사진 {all.length}장</p>
        </div>
        <div className="top-actions">
          {isAdmin && <Link href="/logs" className="btn ghost">접속 기록</Link>}
          <Link href="/upload" className="btn">사진 올리기</Link>
        </div>
      </header>

      <section className="section">
        <div className="section-head">
          <h2>정원pick! ♥</h2>
          {picks.length > 0 && <Link href="/picks" className="more-link">전체 보기 →</Link>}
        </div>
        {picks.length === 0 ? (
          <p className="muted">아직 고른 사진이 없어요. 사진을 크게 열고 ‘♡ 정원pick!’을 눌러 보세요.</p>
        ) : (
          <Gallery photos={picks} albums={albumRefs} />
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>최근 올라온 사진</h2>
          <Link href="/albums" className="more-link">앨범 보기 →</Link>
        </div>
        {recent.length === 0 ? (
          <p className="muted">아직 사진이 없습니다. ‘사진 올리기’에서 첫 사진을 올려 보세요.</p>
        ) : (
          <Gallery photos={recent} albums={albumRefs} />
        )}
      </section>
    </main>
  );
}
