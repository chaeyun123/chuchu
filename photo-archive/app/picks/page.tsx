import { hasEditAccess, hasViewAccess } from "@/lib/auth";
import { listAlbums, listAllPhotos } from "@/lib/drive";
import Locked from "@/components/Locked";
import Gallery from "@/components/Gallery";

export const dynamic = "force-dynamic";

// 정원pick! = 좋아요 누른 사진 모음 (원래 앨범에도 그대로 있음)
export default async function PicksPage() {
  if (!(await hasViewAccess())) return <Locked />;
  const [all, albums, canEdit] = await Promise.all([listAllPhotos(), listAlbums(), hasEditAccess()]);
  const picks = all.filter((p) => p.liked);

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>정원pick! ♥</h1>
          <p className="muted">좋아요한 사진 {picks.length}장</p>
        </div>
      </header>
      {picks.length === 0 ? (
        <p className="muted empty">아직 고른 사진이 없어요.<br />사진을 크게 열고 ‘♡ 정원pick!’을 눌러 보세요.</p>
      ) : (
        <Gallery
          photos={picks}
          canEdit={canEdit}
          albums={albums.map((a) => ({ id: a.id, name: a.name }))}
          defaultSort="taken-desc"
          sortKey="picks"
        />
      )}
    </main>
  );
}
