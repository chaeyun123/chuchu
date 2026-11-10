import type { Metadata } from "next";
import { hasViewAccess } from "@/lib/auth";
import Nav from "@/components/Nav";
import VisitPing from "@/components/VisitPing";
import "./globals.css";

export const metadata: Metadata = {
  title: "JeongWon Archive",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 로그인 전에는 메뉴를 숨깁니다
  const authed = await hasViewAccess();
  return (
    <html lang="ko">
      <body>
        {authed && <Nav />}
        {children}
        <VisitPing />
      </body>
    </html>
  );
}
