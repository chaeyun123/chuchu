"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home" },
  { href: "/calendar", label: "캘린더" },
  { href: "/albums", label: "앨범" },
  { href: "/picks", label: "정원pick!" },
];
const OTHER = new Set(["/", "/calendar", "/picks", "/upload", "/logs"]);

export default function Nav() {
  const path = usePathname();
  // /앨범명 페이지도 '앨범' 탭으로 표시
  const active = (href: string) =>
    href === "/albums" ? path === "/albums" || !OTHER.has(path) : path === href;
  return (
    <nav className="banner" aria-label="메뉴">
      <div className="nav">
        {ITEMS.map((it) => (
          <Link key={it.href} href={it.href} className={active(it.href) ? "on" : undefined} aria-current={active(it.href) ? "page" : undefined}>
            {it.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
