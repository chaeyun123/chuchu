"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceInfo, GameInfo, Photo } from "@/lib/drive";

function fmtDate(p: Photo) {
  const d = p.takenAt ?? p.createdTime;
  return d.slice(0, 10).replace(/-/g, ".");
}

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

function fmtDevice(d?: DeviceInfo): { camera?: string; settings?: string } {
  if (!d) return {};
  // 모델명에 제조사가 이미 들어 있으면 중복 제거 (예: "Canon" + "Canon EOS R6")
  const model = d.model ?? "";
  const camera = [d.make && !model.toLowerCase().startsWith(d.make.toLowerCase()) ? d.make : "", model]
    .filter(Boolean)
    .join(" ");
  const shutter = d.exposureTime
    ? d.exposureTime >= 1 ? `${+d.exposureTime.toFixed(1)}s` : `1/${Math.round(1 / d.exposureTime)}s`
    : "";
  const settings = [
    d.lens,
    d.focalLength ? `${+d.focalLength.toFixed(1)}mm` : "",
    d.aperture ? `f/${+d.aperture.toFixed(1)}` : "",
    shutter,
    d.iso ? `ISO ${d.iso}` : "",
  ].filter(Boolean).join(" · ");
  return { camera: camera || undefined, settings: settings || undefined };
}

const RESULT_LABEL = { win: "승", lose: "패" } as const;

function GameLine({ game }: { game: GameInfo }) {
  if (!game.date && !game.opponent && !game.result) return null;
  return (
    <p className="lb-game">
      {game.date && <span>{game.date.replace(/-/g, ".")}</span>}
      {game.opponent && <span>NC vs ({game.opponent})</span>}
      {game.result && <span className={`result ${game.result}`}>✓ {RESULT_LABEL[game.result]}</span>}
    </p>
  );
}

function GameEditor({ photo, onSaved }: { photo: Photo; onSaved: (g: GameInfo) => void }) {
  const [date, setDate] = useState(photo.game.date ?? (photo.takenAt ?? "").slice(0, 10));
  const [opponent, setOpponent] = useState(photo.game.opponent ?? "");
  const [result, setResult] = useState<GameInfo["result"]>(photo.game.result);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    try {
      const res = await fetch(`/api/photo/${photo.id}/info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, opponent, result: result ?? "" }),
      });
      if (!res.ok) throw new Error();
      const { game } = await res.json();
      onSaved(game);
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  // 같은 칸을 다시 누르면 체크 해제
  const toggle = (r: "win" | "lose") => setResult((cur) => (cur === r ? undefined : r));

  return (
    <form className="game-form" onSubmit={save} onChange={() => setStatus("idle")}>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
      <span className="vs">
        NC vs (
        <input
          value={opponent}
          onChange={(e) => setOpponent(e.target.value)}
          placeholder="상대팀"
          maxLength={30}
          aria-label="상대팀"
        />
        )
      </span>
      <label className="check">
        <input type="checkbox" checked={result === "win"} onChange={() => toggle("win")} /> 승
      </label>
      <label className="check">
        <input type="checkbox" checked={result === "lose"} onChange={() => toggle("lose")} /> 패
      </label>
      <button className="btn light small" disabled={status === "saving"}>
        {status === "saving" ? "저장 중…" : status === "saved" ? "저장됨 ✓" : "저장"}
      </button>
      {status === "error" && <span className="error">저장 실패</span>}
    </form>
  );
}

export default function Gallery({ photos: initial, canEdit = false }: { photos: Photo[]; canEdit?: boolean }) {
  const [photos, setPhotos] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const move = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)),
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      // 입력 중에는 방향키로 사진이 넘어가지 않도록
      if ((e.target as HTMLElement).closest?.("input, textarea")) return;
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
  const device = fmtDevice(current?.device);

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
          onTouchStart={(e) => {
            if ((e.target as HTMLElement).closest(".lb-bar")) return;
            setTouchX(e.touches[0].clientX);
          }}
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
            <div className="lb-info">
              {current.caption && <p className="lb-caption">{current.caption}</p>}
              {canEdit ? (
                <GameEditor
                  key={current.id}
                  photo={current}
                  onSaved={(game) =>
                    setPhotos((ps) => ps.map((p) => (p.id === current.id ? { ...p, game } : p)))
                  }
                />
              ) : (
                <GameLine game={current.game} />
              )}
              <p className="lb-meta">
                {fmtDate(current)}
                {current.uploader && ` · ${current.uploader}`} · {open! + 1}/{photos.length}
              </p>
              {(device.camera || device.settings) && (
                <p className="lb-meta lb-device">
                  📷 {[device.camera, device.settings].filter(Boolean).join(" · ")}
                </p>
              )}
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
