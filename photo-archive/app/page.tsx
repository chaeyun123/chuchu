import Link from "next/link";
import { hasViewAccess } from "@/lib/auth";
import { listAlbums } from "@/lib/drive";
import Locked from "@/components/Locked";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await hasViewAccess())) return <Locked />;
  const albums = await listAlbums();

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <p className="eyebrow">Photo Archive</p>
          <h1>앨범</h1>
        </div>
        <Link href="/upload" className="btn">사진 올리기</Link>
      </header>

      {albums.length === 0 ? (
        <p className="muted empty">아직 앨범이 없습니다. ‘사진 올리기’에서 첫 앨범을 만들어 보세요.</p>
      ) : (
        <ul className="albums">
          {albums.map((a) => (
            <li key={a.id}>
              <Link href={`/${encodeURIComponent(a.name)}`} className="album">
                <div className="cover">
                  {a.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`/api/photo/${a.cover}?w=480`} alt="" loading="lazy" />
                  ) : (
                    <span className="nocover">사진 없음</span>
                  )}
                </div>
                <span className="album-name">{a.name}</span>
                <span className="album-date">{a.createdTime.slice(0, 10)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
