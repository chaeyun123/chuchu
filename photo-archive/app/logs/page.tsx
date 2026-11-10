import Link from "next/link";
import { hasUploadAccess, hasViewAccess } from "@/lib/auth";
import { readAccessLog } from "@/lib/drive";
import Locked from "@/components/Locked";

export const dynamic = "force-dynamic";

// 접속 기록 보기 — 업로드 비밀번호로 로그인한 사람만
export default async function LogsPage() {
  if (!(await hasViewAccess())) return <Locked />;
  if (!(await hasUploadAccess())) {
    return (
      <main className="locked">
        <h1>관리자만 볼 수 있어요</h1>
        <p className="muted">‘사진 올리기’에서 업로드 비밀번호로 먼저 로그인해 주세요.</p>
        <p><Link href="/upload" className="btn">사진 올리기로 가기</Link></p>
      </main>
    );
  }
  const rows = (await readAccessLog()).reverse().slice(0, 500);

  return (
    <main className="wrap">
      <header className="top">
        <div>
          <Link href="/" className="back">← Home</Link>
          <h1>접속 기록</h1>
          <p className="muted">최근 {rows.length}건 · 전체 기록은 구글 드라이브의 ‘접속기록.csv’</p>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="muted empty">아직 기록이 없습니다.</p>
      ) : (
        <div className="log-wrap">
          <table className="log">
            <thead>
              <tr><th>시간</th><th>구분</th><th>아이디</th><th>페이지</th><th>IP</th><th>위치</th><th>기기</th></tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r[1] === "로그인 실패" ? "fail" : undefined}>
                  {r.slice(0, 7).map((c, j) => <td key={j}>{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
