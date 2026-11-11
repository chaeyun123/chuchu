import Link from "next/link";
import { hasEditAccess, hasViewAccess } from "@/lib/auth";
import Locked from "@/components/Locked";
import Uploader from "@/components/Uploader";

export const dynamic = "force-dynamic";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  if (!(await hasViewAccess())) return <Locked />;
  if (!(await hasEditAccess())) {
    return (
      <main className="locked">
        <h1>관리자 계정만 사진을 올릴 수 있어요</h1>
        <p className="muted">admin 계정으로 로그인하면 업로드·수정·삭제를 할 수 있습니다.</p>
        <p><Link href="/" className="btn">홈으로</Link></p>
      </main>
    );
  }
  const { album } = await searchParams;
  return (
    <main className="wrap narrow">
      <header className="top">
        <div>
          <Link href="/albums" className="back">← 앨범 목록</Link>
          <h1>사진 올리기</h1>
        </div>
      </header>
      <Uploader initialAlbum={album} />
    </main>
  );
}
