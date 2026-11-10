import Link from "next/link";
import { hasUploadAccess, hasViewAccess } from "@/lib/auth";
import Locked from "@/components/Locked";
import Uploader from "@/components/Uploader";

export const dynamic = "force-dynamic";

export default async function UploadPage({ searchParams }: { searchParams: Promise<{ album?: string }> }) {
  if (!(await hasViewAccess())) return <Locked />;
  const { album } = await searchParams;
  return (
    <main className="wrap narrow">
      <header className="top">
        <div>
          <Link href="/albums" className="back">← 앨범 목록</Link>
          <h1>사진 올리기</h1>
        </div>
      </header>
      <Uploader authorized={await hasUploadAccess()} initialAlbum={album} />
    </main>
  );
}
