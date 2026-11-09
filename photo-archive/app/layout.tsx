import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "JeongWon Archive",
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <div className="banner">
          <Link href="/" className="banner-title">JeongWon Archive</Link>
        </div>
        {children}
      </body>
    </html>
  );
}
