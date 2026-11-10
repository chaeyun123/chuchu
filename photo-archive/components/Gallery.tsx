"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

// ── 정렬 ──
export type SortMode = "upload-desc" | "upload-asc" | "taken-desc" | "taken-asc";
const SORT_LABEL: Record<SortMode, string> = {
  "upload-desc": "업로드 최신순",
  "upload-asc": "업로드 오래된 순",
  "taken-desc": "촬영 최신순",
  "taken-asc": "촬영 오래된 순",
};
const isSort = (v: unknown): v is SortMode => typeof v === "string" && v in SORT_LABEL;
export function sortPhotos(list: Photo[], mode: SortMode): Photo[] {
  const key = (p: Photo) => (mode.startsWith("upload") ? p.createdTime : p.takenAt ?? p.createdTime);
  const dir = mode.endsWith("desc") ? -1 : 1;
  return [...list].sort((a, b) => dir * key(a).localeCompare(key(b)));
}

const UNIFORMS = ["홈", "원정", "썸머", "스페셜", "올드", "밀리터리"];

function GameLine({ game }: { game: GameInfo }) {
  if (!game.date && !game.opponent && !game.result && !game.uniform) return null;
  return (
    <p className="lb-game">
      {game.date && <span>{game.date.replace(/-/g, ".")}</span>}
      {game.opponent && <span>NC vs ({game.opponent})</span>}
      {game.result && <span className={`result ${game.result}`}>✓ {RESULT_LABEL[game.result]}</span>}
      {game.uniform && <span>👕 {game.uniform} 유니폼</span>}
    </p>
  );
}

type Saved = { caption?: string; game: GameInfo };
export type AlbumRef = { id: string; name: string };

/** 여러 장 삭제/이동 요청 → 성공한 id 목록 */
async function bulk(action: "delete" | "move", ids: string[], to?: string): Promise<string[]> {
  const res = await fetch("/api/photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ids, to }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
  if (data.failed) alert(`${data.failed}장은 처리하지 못했어요.`);
  return data.done as string[];
}

function MovePicker({ albums, exclude, busy, onMove, onCancel, dark = false }: {
  albums: AlbumRef[];
  exclude?: string;
  busy: boolean;
  onMove: (to: string) => void;
  onCancel: () => void;
  dark?: boolean;
}) {
  const options = albums.filter((a) => a.id !== exclude);
  const [to, setTo] = useState(options[0]?.id ?? "");
  if (options.length === 0) return <span className="muted">옮길 다른 앨범이 없어요</span>;
  return (
    <span className="move-picker">
      <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="옮길 앨범" className={dark ? "dark" : ""}>
        {options.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="button" className={`btn small ${dark ? "light" : ""}`} disabled={busy || !to} onClick={() => onMove(to)}>
        {busy ? "옮기는 중…" : "이동"}
      </button>
      <button type="button" className={`btn small ${dark ? "ghost-light" : "ghost"}`} disabled={busy} onClick={onCancel}>취소</button>
    </span>
  );
}

function PhotoEditor({ photo, onSaved, onCancel }: {
  photo: Photo;
  onSaved: (s: Saved) => void;
  onCancel: () => void;
}) {
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [date, setDate] = useState(photo.game.date ?? (photo.takenAt ?? "").slice(0, 10));
  const [opponent, setOpponent] = useState(photo.game.opponent ?? "");
  const [result, setResult] = useState<GameInfo["result"]>(photo.game.result);
  const [uniform, setUniform] = useState(photo.game.uniform ?? "");
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
        body: JSON.stringify({ caption, date, opponent, result: result ?? "", uniform }),
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
        <span className="vs-label">유니폼</span>
        <div className="teams" role="group" aria-label="유니폼 종류">
          {UNIFORMS.map((u) => (
            <button
              key={u}
              type="button"
              className={`chip ${uniform === u ? "on" : ""}`}
              aria-pressed={uniform === u}
              onClick={() => setUniform((cur) => (cur === u ? "" : u))}
            >
              {u}
            </button>
          ))}
        </div>
        <input
          className="edit-uniform"
          value={UNIFORMS.includes(uniform) ? "" : uniform}
          onChange={(e) => setUniform(e.target.value)}
          placeholder="직접 입력"
          maxLength={20}
          aria-label="유니폼 직접 입력"
        />
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

export default function Gallery({
  photos: initial,
  canEdit = false,
  albums = [],
  albumId,
  selectable = false,
  defaultSort = "upload-desc",
  sortKey,
  lightboxOnly = false,
  startIndex = 0,
  onClose,
}: {
  photos: Photo[];
  canEdit?: boolean;
  /** 이동할 수 있는 앨범 목록 (없으면 이동·앨범명 표시 생략) */
  albums?: AlbumRef[];
  /** 특정 앨범 페이지일 때: 다른 앨범으로 옮긴 사진은 목록에서 빠짐 */
  albumId?: string;
  /** 여러 장 선택(삭제·이동) 버튼 표시 — 앨범 페이지에서만 */
  selectable?: boolean;
  defaultSort?: SortMode;
  /** 있으면 정렬 선택을 이 이름으로 브라우저에 기억 */
  sortKey?: string;
  /** 목록 없이 크게 보기만 (캘린더용) */
  lightboxOnly?: boolean;
  startIndex?: number;
  onClose?: () => void;
}) {
  const router = useRouter();
  const [photos, setPhotos] = useState(initial);
  const [open, setOpen] = useState<number | null>(lightboxOnly ? startIndex : null);
  const [sort, setSort] = useState<SortMode>(defaultSort);
  const view = useMemo(() => sortPhotos(photos, sort), [photos, sort]);
  const [panel, setPanel] = useState<"none" | "edit" | "move">("none");
  const [busy, setBusy] = useState(false);
  // 여러 장 선택 모드
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMove, setBulkMove] = useState(false);

  useEffect(() => setPhotos(initial), [initial]);

  // 기억해 둔 정렬 불러오기
  useEffect(() => {
    if (!sortKey) return;
    try {
      const v = localStorage.getItem(`pa_sort:${sortKey}`);
      if (isSort(v)) setSort(v);
    } catch {}
  }, [sortKey]);
  function changeSort(v: SortMode) {
    setSort(v);
    if (sortKey) try { localStorage.setItem(`pa_sort:${sortKey}`, v); } catch {}
  }

  const albumName = (id: string) => albums.find((a) => a.id === id)?.name;
  const editing = panel !== "none";

  const close = useCallback(() => {
    setOpen(null);
    setPanel("none");
    onClose?.();
  }, [onClose]);
  const move = useCallback(
    (d: number) => {
      setPanel("none");
      setOpen((i) => (i === null ? i : (i + d + view.length) % view.length));
    },
    [view.length],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      // 입력 중에는 방향키로 사진이 넘어가지 않도록
      if ((e.target as HTMLElement).closest?.("input, textarea, select")) return;
      if (e.key === "Escape") (editing ? setPanel("none") : close());
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
    if (open === null || view.length < 2) return;
    for (const d of [1, -1]) {
      const p = view[(open + d + view.length) % view.length];
      const img = new Image();
      img.src = `/api/photo/${p.id}?w=1600`;
    }
  }, [open, view]);

  // 모바일 스와이프
  const [touchX, setTouchX] = useState<number | null>(null);

  const current = open !== null ? view[open] ?? null : null;
  const device = fmtDevice(current?.device);

  /** 삭제·이동 후 화면 정리 */
  function afterChange(ids: string[], action: "delete" | "move", to?: string) {
    const gone = new Set(ids);
    const leaves = action === "delete" || (albumId !== undefined && to !== albumId);
    const curId = current?.id;
    const rest = leaves
      ? photos.filter((p) => !gone.has(p.id))
      : photos.map((p) => (gone.has(p.id) ? { ...p, albumId: to! } : p));
    setPhotos(rest);
    if (open !== null && leaves && curId && gone.has(curId)) {
      if (rest.length) setOpen(Math.min(open, rest.length - 1));
      else close();
    }
    setPanel("none");
    router.refresh(); // 사진 개수·대표 사진 갱신
  }

  async function run(action: "delete" | "move", ids: string[], to?: string) {
    setBusy(true);
    try {
      afterChange(await bulk(action, ids, to), action, to);
      return true;
    } catch (e) {
      alert((e as Error).message || "처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function removeCurrent() {
    if (!current) return;
    if (!confirm("이 사진을 삭제할까요?\n(Google Drive 휴지통으로 옮겨지며 30일 안에 복구할 수 있어요)")) return;
    await run("delete", [current.id]);
  }

  async function removeSelected() {
    const ids = [...selected];
    if (!ids.length) return;
    if (!confirm(`사진 ${ids.length}장을 삭제할까요?\n(Google Drive 휴지통으로 옮겨지며 30일 안에 복구할 수 있어요)`)) return;
    if (await run("delete", ids)) exitSelect();
  }

  async function moveSelected(to: string) {
    if (await run("move", [...selected], to)) exitSelect();
  }

  function exitSelect() {
    setSelecting(false);
    setSelected(new Set());
    setBulkMove(false);
  }

  function toggleSelect(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function toggleLike(p: Photo) {
    const liked = !p.liked;
    const set = (v: boolean) => setPhotos((ps) => ps.map((x) => (x.id === p.id ? { ...x, liked: v } : x)));
    set(liked);
    try {
      const res = await fetch(`/api/photo/${p.id}/like`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ liked }),
      });
      if (!res.ok) throw new Error();
    } catch {
      set(!liked);
      alert("좋아요를 저장하지 못했어요.");
    }
  }

  return (
    <>
      {!lightboxOnly && (
        <div className={`select-bar ${selecting ? "on" : ""}`}>
          {!selecting ? (
            <>
              <select className="sort-select" value={sort} onChange={(e) => changeSort(e.target.value as SortMode)} aria-label="정렬">
                {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => <option key={k} value={k}>{SORT_LABEL[k]}</option>)}
              </select>
              <span className="spacer" />
              {canEdit && selectable && (
                <button className="btn ghost small" onClick={() => setSelecting(true)}>선택</button>
              )}
            </>
          ) : (
            <>
              <span className="select-count">{selected.size}장 선택됨</span>
              <button
                className="btn ghost small"
                onClick={() =>
                  setSelected(selected.size === view.length ? new Set() : new Set(view.map((p) => p.id)))
                }
              >
                {selected.size === view.length ? "선택 해제" : "전체 선택"}
              </button>
              <span className="spacer" />
              {bulkMove ? (
                <MovePicker
                  albums={albums}
                  exclude={albumId}
                  busy={busy}
                  onMove={moveSelected}
                  onCancel={() => setBulkMove(false)}
                />
              ) : (
                <>
                  {albums.length > 0 && (
                    <button className="btn small" disabled={!selected.size || busy} onClick={() => setBulkMove(true)}>
                      앨범 이동
                    </button>
                  )}
                  <button className="btn danger small" disabled={!selected.size || busy} onClick={removeSelected}>
                    {busy ? "삭제 중…" : "삭제"}
                  </button>
                  <button className="btn ghost small" onClick={exitSelect} disabled={busy}>완료</button>
                </>
              )}
            </>
          )}
        </div>
      )}

      {!lightboxOnly && <ul className="grid">
        {view.map((p, i) => {
          const isSel = selected.has(p.id);
          return (
            <li key={p.id}>
              <button
                className={`thumb ${selecting ? "selecting" : ""} ${isSel ? "selected" : ""}`}
                onClick={() => (selecting ? toggleSelect(p.id) : setOpen(i))}
                aria-label={p.caption || p.name}
                aria-pressed={selecting ? isSel : undefined}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/photo/${p.id}?w=480`}
                  alt={p.caption || p.name}
                  loading="lazy"
                  width={p.width}
                  height={p.height}
                />
                {p.liked && <span className="thumb-heart" aria-label="정원pick">♥</span>}
                {selecting && <span className="thumb-check" aria-hidden>{isSel ? "✓" : ""}</span>}
              </button>
            </li>
          );
        })}
      </ul>}

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
            {view.length > 1 && (
              <button className="lb-nav lb-prev" onClick={() => move(-1)} aria-label="이전">‹</button>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={current.id} src={`/api/photo/${current.id}?w=1600`} alt={current.caption || current.name} />
            {view.length > 1 && (
              <button className="lb-nav lb-next" onClick={() => move(1)} aria-label="다음">›</button>
            )}
          </div>

          <div className="lb-bar">
            {panel === "edit" ? (
              <PhotoEditor
                key={current.id}
                photo={current}
                onCancel={() => setPanel("none")}
                onSaved={(s) => {
                  setPhotos((ps) => ps.map((p) => (p.id === current.id ? { ...p, ...s } : p)));
                  setPanel("none");
                }}
              />
            ) : (
              <>
                <div className="lb-info">
                  {current.caption && <p className="lb-caption">{current.caption}</p>}
                  <GameLine game={current.game} />
                  <p className="lb-meta">
                    {fmtDate(current)}
                    {current.uploader && ` · ${current.uploader}`}
                    {albumId === undefined && albumName(current.albumId) && ` · 📁 ${albumName(current.albumId)}`}
                    {" · "}{open! + 1}/{view.length}
                  </p>
                  {device && <p className="lb-meta lb-device">📷 {device}</p>}
                </div>
                <div className="lb-actions">
                  {panel === "move" ? (
                    <MovePicker
                      key={current.id}
                      dark
                      albums={albums}
                      exclude={current.albumId}
                      busy={busy}
                      onMove={(to) => run("move", [current.id], to)}
                      onCancel={() => setPanel("none")}
                    />
                  ) : (
                    <>
                      <button
                        className={`btn small like ${current.liked ? "on" : ""}`}
                        onClick={() => toggleLike(current)}
                        aria-pressed={current.liked}
                      >
                        {current.liked ? "♥" : "♡"} 정원pick!
                      </button>
                      {canEdit && (
                        <>
                          <button className="btn ghost-light small" onClick={() => setPanel("edit")}>수정</button>
                          {albums.length > 1 && (
                            <button className="btn ghost-light small" onClick={() => setPanel("move")}>이동</button>
                          )}
                          <button className="btn danger small" onClick={removeCurrent} disabled={busy}>
                            {busy ? "삭제 중…" : "삭제"}
                          </button>
                        </>
                      )}
                      <a className="btn light small" href={`/api/photo/${current.id}?download=1`} download>
                        원본 ({fmtSize(current.size)})
                      </a>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
