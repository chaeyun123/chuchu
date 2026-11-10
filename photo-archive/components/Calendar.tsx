"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Photo } from "@/lib/drive";
import Gallery, { type AlbumRef } from "./Gallery";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

function shift(month: string, d: number): string {
  const [y, m] = month.split("-").map(Number);
  const t = new Date(y, m - 1 + d, 1);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}`;
}

/** 아이폰 캘린더 모양의 월간 달력. 사진이 있는 날은 칸에 사진이 들어갑니다. */
export default function Calendar({ month, today, days, months, canEdit, albums }: {
  month: string; // YYYY-MM
  today: string; // YYYY-MM-DD
  days: Record<string, Photo[]>;
  months: [string, number][]; // 사진 있는 달 [YYYY-MM, 장수]
  canEdit: boolean;
  albums: AlbumRef[];
}) {
  const router = useRouter();
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y, m - 1, 1).getDay();
  const count = new Date(y, m, 0).getDate();
  const [selected, setSelected] = useState<string | null>(today.startsWith(month) ? today : null);
  const [touchX, setTouchX] = useState<number | null>(null);

  const cells: (string | null)[] = [
    ...Array<null>(first).fill(null),
    ...Array.from({ length: count }, (_, i) => `${month}-${pad(i + 1)}`),
  ];
  while (cells.length % 7) cells.push(null);

  const go = (d: number) => router.push(`/calendar?m=${shift(month, d)}`);
  const total = Object.values(days).reduce((n, l) => n + l.length, 0);
  const sel = selected ? days[selected] ?? [] : [];
  const selLabel = selected
    ? `${Number(selected.slice(5, 7))}월 ${Number(selected.slice(8))}일 ${WEEK[new Date(+selected.slice(0, 4), +selected.slice(5, 7) - 1, +selected.slice(8)).getDay()]}요일`
    : "";

  return (
    <div className="ical">
      <div className="ical-top">
        <Link href={`/calendar?m=${shift(month, -1)}`} className="ical-red" aria-label="이전 달">‹ {shift(month, -1).slice(5).replace(/^0/, "")}월</Link>
        <div className="ical-top-right">
          {months.length > 0 && (
            <select
              className="ical-jump"
              value={months.some(([k]) => k === month) ? month : ""}
              onChange={(e) => e.target.value && router.push(`/calendar?m=${e.target.value}`)}
              aria-label="사진 있는 달로 이동"
            >
              <option value="">사진 있는 달</option>
              {months.map(([k, n]) => (
                <option key={k} value={k}>{k.replace("-", "년 ").replace(/ 0/, " ")}월 · {n}장</option>
              ))}
            </select>
          )}
          {!today.startsWith(month) && (
            <Link href="/calendar" className="ical-red">오늘</Link>
          )}
          <Link href={`/calendar?m=${shift(month, 1)}`} className="ical-red" aria-label="다음 달">{shift(month, 1).slice(5).replace(/^0/, "")}월 ›</Link>
        </div>
      </div>

      <h1 className="ical-title">
        {m}월 <span className="ical-year">{y}</span>
      </h1>
      <p className="muted ical-sub">{total ? `사진 ${total}장` : "이 달에는 사진이 없어요"}</p>

      <div className="ical-week">
        {WEEK.map((w, i) => (
          <span key={w} className={i === 0 || i === 6 ? "weekend" : undefined}>{w}</span>
        ))}
      </div>

      <div
        className="ical-grid"
        onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX === null) return;
          const dx = e.changedTouches[0].clientX - touchX;
          if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1);
          setTouchX(null);
        }}
      >
        {cells.map((d, i) => {
          if (!d) return <div key={`e${i}`} className="ical-cell empty" />;
          const list = days[d];
          const dow = i % 7;
          const cls = [
            "ical-cell",
            d === today ? "today" : "",
            d === selected ? "selected" : "",
            dow === 0 || dow === 6 ? "weekend" : "",
            list ? "has" : "",
          ].join(" ");
          return (
            <button key={d} className={cls} onClick={() => setSelected(d)} aria-label={`${Number(d.slice(8))}일${list ? `, 사진 ${list.length}장` : ""}`}>
              <span className="ical-num">{Number(d.slice(8))}</span>
              <span className="ical-photo">
                {list && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/photo/${list[0].id}?w=480`} alt="" loading="lazy" />
                    {list.length > 1 && <span className="ical-count">{list.length}</span>}
                  </>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {selected && (
        <section className="ical-day">
          <h2>{selLabel}</h2>
          {sel.length === 0 ? (
            <p className="muted">이 날은 사진이 없어요.</p>
          ) : (
            <Gallery key={selected} photos={sel} canEdit={canEdit} albums={albums} />
          )}
        </section>
      )}
    </div>
  );
}
