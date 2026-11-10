import Link from "next/link";
import { hasUploadAccess, hasViewAccess } from "@/lib/auth";
import { listAlbums, listPhotos, type Album } from "@/lib/drive";
import Locked from "@/components/Locked";

export const dynamic = "force-dynamic";

/** 대표 사진을 맨 앞에 두고, 3장 이하면 전부 · 4장 이상이면 2장 + "+나머지" */
async function preview(album: Album) {
  const photos = await listPhotos(album.id).catch(() => []);
  const ids = photos.map((p) => p.id);
  if (album.cover && ids.includes(album.cover)) {
    ids.splice(ids.indexOf(album.cover), 1);
    ids.unshift(album.cover);
  }
  const shown = ids.length > 3 ? ids.slice(0, 2) : ids;
  return { album, shown, more: ids.length - shown.length };
}

export default async function Home() {
  if (!(await hasViewAccess())) return <Locked />;
  const albums = await Promise.all((await listAlbums()).map(preview));
  const isAdmin = await hasUploadAccess();

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <h1>정원!!</h1>
        </div>
        <div className="top-actions">
          {isAdmin && <Link href="/logs" className="btn ghost">접속 기록</Link>}
          <Link href="/upload" className="btn">사진 올리기</Link>
        </div>
      </header>

      {albums.length === 0 ? (
        <p className="muted empty">아직 앨범이 없습니다. ‘사진 올리기’에서 첫 앨범을 만들어 보세요.</p>
      ) : (
        <ul className="albums">
          {albums.map(({ album: a, shown, more }) => {
            const tiles = shown.length + (more > 0 ? 1 : 0);
            return (
              <li key={a.id}>
                <Link href={`/${encodeURIComponent(a.name)}`} className="album">
                  <div className={`cover n${tiles}`}>
                    {shown.length === 0 && <span className="nocover">사진 없음</span>}
                    {shown.map((id) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={id} src={`/api/photo/${id}?w=480`} alt="" loading="lazy" />
                    ))}
                    {more > 0 && <span className="more">+{more}</span>}
                  </div>
                  <span className="album-name">{a.name}</span>
                  <span className="album-date">{a.createdTime.slice(0, 10)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
