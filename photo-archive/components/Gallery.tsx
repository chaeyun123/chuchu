"use client";

import { useCallback, useEffect, useState } from "react";
import type { Photo } from "@/lib/drive";

function fmtDate(p: Photo) {
  const d = p.takenAt ?? p.createdTime;
  return d.slice(0, 10).replace(/-/g, ".");
}

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

export default function Gallery({ photos }: { photos: Photo[] }) {
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const move = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, move]);

  // 다음/이전 사진 미리 불러오기
  useEffect(() => {
    if (open === null) return;
    for (const d of [1, -1]) {
      const p = photos[(open + d + photos.length) % photos.length];
      const img = new Image();
      img.src = `/api/photo/${p.id}?w=1600`;
    }
  }, [open, photos]);

  // 모바일 스와이프
  const [touchX, setTouchX] = useState<number | null>(null);

  const current = open !== null ? photos[open] : null;

  return (
    <>
      <ul className="grid">
        {photos.map((p, i) => (
          <li key={p.id}>
            <button className="thumb" onClick={() => setOpen(i)} aria-label={p.caption || p.name}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photo/${p.id}?w=480`}
                alt={p.caption || p.name}
                loading="lazy"
                width={p.width}
                height={p.height}
              />
            </button>
          </li>
        ))}
      </ul>

      {current && (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.target === e.currentTarget && close()}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50) move(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <button className="lb-close" onClick={close} aria-label="닫기">×</button>
          <button className="lb-nav lb-prev" onClick={() => move(-1)} aria-label="이전">‹</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={current.id} src={`/api/photo/${current.id}?w=1600`} alt={current.caption || current.name} />
          <button className="lb-nav lb-next" onClick={() => move(1)} aria-label="다음">›</button>
          <div className="lb-bar">
            <div>
              {current.caption && <p className="lb-caption">{current.caption}</p>}
              <p className="lb-meta">
                {fmtDate(current)}
                {current.uploader && ` · ${current.uploader}`} · {open! + 1}/{photos.length}
              </p>
            </div>
            <a className="btn light" href={`/api/photo/${current.id}?download=1`} download>
              원본 다운로드 ({fmtSize(current.size)})
            </a>
          </div>
        </div>
      )}
    </>
  );
}
