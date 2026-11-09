"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { DeviceInfo, GameInfo, Photo } from "@/lib/drive";
import { TEAMS } from "@/lib/teams";

function fmtDate(p: Photo) {
  const d = p.takenAt ?? p.createdTime;
  return d.slice(0, 10).replace(/-/g, ".");
}

function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

function fmtDevice(d?: DeviceInfo): string | undefined {
  if (!d) return undefined;
  // 모델명에 제조사가 이미 들어 있으면 중복 제거 (예: "Canon" + "Canon EOS R6")
  const model = d.model ?? "";
  const camera = [d.make && !model.toLowerCase().startsWith(d.make.toLowerCase()) ? d.make : "", model]
    .filter(Boolean)
    .join(" ");
  const shutter = d.exposureTime
    ? d.exposureTime >= 1 ? `${+d.exposureTime.toFixed(1)}s` : `1/${Math.round(1 / d.exposureTime)}s`
    : "";
  const parts = [
    camera,
    d.lens,
    d.focalLength ? `${+d.focalLength.toFixed(1)}mm` : "",
    d.aperture ? `f/${+d.aperture.toFixed(1)}` : "",
    shutter,
    d.iso ? `ISO ${d.iso}` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : undefined;
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

type Saved = { caption?: string; game: GameInfo };

function PhotoEditor({ photo, onSaved, onCancel }: {
  photo: Photo;
  onSaved: (s: Saved) => void;
  onCancel: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [date, setDate] = useState(photo.game.date ?? (photo.takenAt ?? "").slice(0, 10));
  const [opponent, setOpponent] = useState(photo.game.opponent ?? "");
  const [result, setResult] = useState<GameInfo["result"]>(photo.game.result);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(false);
    try {
      const res = await fetch(`/api/photo/${photo.id}/info`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, date, opponent, result: result ?? "" }),
      });
      if (!res.ok) throw new Error();
      onSaved(await res.json());
    } catch {
      setError(true);
      setSaving(false);
    }
  }

  // 같은 항목을 다시 누르면 선택 해제
  const toggleResult = (r: "win" | "lose") => setResult((cur) => (cur === r ? undefined : r));

  return (
    <form className="edit-form" onSubmit={save}>
      <div className="edit-row">
        <input
          className="edit-caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="설명 (선택)"
          maxLength={50}
          aria-label="설명"
        />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="날짜" />
      </div>
      <div className="edit-row">
        <span className="vs-label">NC vs</span>
        <div className="teams" role="group" aria-label="상대팀">
          {TEAMS.map((t) => (
            <button
              key={t}
              type="button"
              className={`chip ${opponent === t ? "on" : ""}`}
              aria-pressed={opponent === t}
              onClick={() => setOpponent((cur) => (cur === t ? "" : t))}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="edit-row">
        <label className="check">
          <input type="checkbox" checked={result === "win"} onChange={() => toggleResult("win")} /> 승
        </label>
        <label className="check">
          <input type="checkbox" checked={result === "lose"} onChange={() => toggleResult("lose")} /> 패
        </label>
        <span className="spacer" />
        {error && <span className="error">저장 실패</span>}
        <button type="button" className="btn ghost-light small" onClick={onCancel} disabled={saving}>취소</button>
        <button className="btn light small" disabled={saving}>{saving ? "저장 중…" : "저장"}</button>
      </div>
    </form>
  );
}

export default function Gallery({ photos: initial, canEdit = false }: { photos: Photo[]; canEdit?: boolean }) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [open, setOpen] = useState<number | null>(null);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => setPhotos(initial), [initial]);

  const close = useCallback(() => {
    setOpen(null);
    setEditing(false);
  }, []);
  const move = useCallback(
    (d: number) => {
      setEditing(false);
      setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length));
    },
    [photos.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      // 입력 중에는 방향키로 사진이 넘어가지 않도록
      if ((e.target as HTMLElement).closest?.("input, textarea")) return;
      if (e.key === "Escape") (editing ? setEditing(false) : close());
      if (editing) return;
      if (e.key === "ArrowRight") move(1);
      if (e.key === "ArrowLeft") move(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, editing, close, move]);

  // 다음/이전 사진 미리 불러오기
  useEffect(() => {
    if (open === null || photos.length < 2) return;
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

  async function remove() {
    if (!current || open === null) return;
    if (!confirm("이 사진을 삭제할까요?\n(Google Drive 휴지통으로 옮겨지며 30일 안에 복구할 수 있어요)")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/photo/${current.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      const rest = photos.filter((p) => p.id !== current.id);
      setPhotos(rest);
      setOpen(rest.length ? Math.min(open, rest.length - 1) : null);
      router.refresh(); // 사진 개수·대표 사진 갱신
    } catch {
      alert("삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setDeleting(false);
    }
  }

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
          onTouchStart={(e) => {
            if ((e.target as HTMLElement).closest(".lb-bar")) return;
            setTouchX(e.touches[0].clientX);
          }}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 50 && !editing) move(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <button className="lb-close" onClick={close} aria-label="닫기">×</button>

          <div className="lb-stage" onClick={(e) => e.target === e.currentTarget && close()}>
            {photos.length > 1 && (
              <button className="lb-nav lb-prev" onClick={() => move(-1)} aria-label="이전">‹</button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={current.id} src={`/api/photo/${current.id}?w=1600`} alt={current.caption || current.name} />
            {photos.length > 1 && (
              <button className="lb-nav lb-next" onClick={() => move(1)} aria-label="다음">›</button>
            )}
          </div>

          <div className="lb-bar">
            {editing ? (
              <PhotoEditor
                key={current.id}
                photo={current}
                onCancel={() => setEditing(false)}
                onSaved={(s) => {
                  setPhotos((ps) => ps.map((p) => (p.id === current.id ? { ...p, ...s } : p)));
                  setEditing(false);
                }}
              />
            ) : (
              <>
                <div className="lb-info">
                  {current.caption && <p className="lb-caption">{current.caption}</p>}
                  <GameLine game={current.game} />
                  <p className="lb-meta">
                    {fmtDate(current)}
                    {current.uploader && ` · ${current.uploader}`} · {open! + 1}/{photos.length}
                  </p>
                  {device && <p className="lb-meta lb-device">📷 {device}</p>}
                </div>
                <div className="lb-actions">
                  {canEdit && (
                    <>
                      <button className="btn ghost-light small" onClick={() => setEditing(true)}>수정</button>
                      <button className="btn danger small" onClick={remove} disabled={deleting}>
                        {deleting ? "삭제 중…" : "삭제"}
                      </button>
                    </>
                  )}
                  <a className="btn light small" href={`/api/photo/${current.id}?download=1`} download>
                    원본 ({fmtSize(current.size)})
                  </a>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
