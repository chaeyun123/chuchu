"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Album = { id: string; name: string };
type Item = { file: File; progress: number; status: "대기" | "업로드 중" | "완료" | "실패"; error?: string };

const CHUNK = 4 * 1024 * 1024; // 4MB (256KB의 배수여야 함)

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
  return data as T;
}

export default function Uploader({ initialAlbum }: { initialAlbum?: string }) {
  const router = useRouter();

  const [albums, setAlbums] = useState<Album[]>([]);
  const [albumId, setAlbumId] = useState("");
  const [newAlbum, setNewAlbum] = useState("");
  const [uploader, setUploader] = useState("");
  const [caption, setCaption] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try { setUploader(localStorage.getItem("pa_uploader") ?? ""); } catch {}
  }, []);

  useEffect(() => {
    fetch("/api/albums").then(json<Album[]>).then((list) => {
      setAlbums(list);
      const init = list.find((a) => a.name === initialAlbum) ?? list[0];
      if (init) setAlbumId(init.id);
    }).catch((e) => setMessage(e.message));
  }, [initialAlbum]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith("image/"));
    setItems((prev) => [...prev, ...imgs.map((file) => ({ file, progress: 0, status: "대기" as const }))]);
  }

  const update = (i: number, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  async function uploadOne(item: Item, i: number, targetAlbum: string) {
    const { file } = item;
    update(i, { status: "업로드 중", progress: 0 });
    const { sessionUrl } = await json<{ sessionUrl: string }>(
      await fetch("/api/upload/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: targetAlbum,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          caption,
          uploader,
        }),
      }),
    );
    let start = 0;
    while (start < file.size) {
      const blob = file.slice(start, Math.min(start + CHUNK, file.size));
      const qs = new URLSearchParams({ session: sessionUrl, start: String(start), total: String(file.size) });
      const r = await json<{ done: boolean; next?: number }>(
        await fetch(`/api/upload/chunk?${qs}`, { method: "PUT", body: blob }),
      );
      if (r.done) break;
      start = r.next ?? start + blob.size;
      update(i, { progress: Math.round((start / file.size) * 100) });
    }
    update(i, { status: "완료", progress: 100 });
  }

  async function startUpload() {
    setMessage("");
    setBusy(true);
    try {
      try { localStorage.setItem("pa_uploader", uploader); } catch {}
      let target = albumId;
      let targetName = albums.find((a) => a.id === albumId)?.name ?? "";
      if (newAlbum.trim()) {
        const created = await json<Album>(
          await fetch("/api/albums", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: newAlbum.trim() }),
          }),
        );
        target = created.id;
        targetName = created.name;
        setAlbums((prev) => (prev.some((a) => a.id === created.id) ? prev : [created, ...prev]));
        setAlbumId(created.id);
        setNewAlbum("");
      }
      if (!target) throw new Error("앨범을 선택하거나 새로 만들어 주세요");

      let failed = 0;
      for (let i = 0; i < items.length; i++) {
        if (items[i].status === "완료") continue;
        try {
          await uploadOne(items[i], i, target);
        } catch (e) {
          failed++;
          update(i, { status: "실패", error: (e as Error).message });
        }
      }
      if (failed === 0) {
        setMessage("업로드 완료! 앨범으로 이동합니다…");
        setTimeout(() => router.push(`/${encodeURIComponent(targetName)}?id=${target}`), 800);
      } else {
        setMessage(`${failed}개 파일이 실패했습니다. 다시 ‘업로드’를 누르면 실패한 파일만 재시도합니다.`);
      }
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const pending = items.filter((it) => it.status !== "완료").length;

  return (
    <div className="card">
      <label>
        앨범 선택
        <select value={albumId} onChange={(e) => setAlbumId(e.target.value)} disabled={!!newAlbum.trim()}>
          {albums.length === 0 && <option value="">(앨범 없음)</option>}
          {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </label>
      <label>
        또는 새 앨범 만들기
        <input value={newAlbum} onChange={(e) => setNewAlbum(e.target.value)} placeholder="예: 2026 제주 여행" />
      </label>
      <div className="row">
        <label>
          올리는 사람
          <input value={uploader} onChange={(e) => setUploader(e.target.value)} placeholder="이름 (선택)" />
        </label>
        <label>
          설명
          <input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="사진 설명 (선택)" />
        </label>
      </div>

      <div
        className={`drop ${drag ? "on" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      >
        사진을 끌어다 놓거나 눌러서 선택하세요
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {items.length > 0 && (
        <ul className="queue">
          {items.map((it, i) => (
            <li key={i}>
              <span className="qname">{it.file.name}</span>
              <span className={`qstatus s-${it.status}`}>{it.status === "업로드 중" ? `${it.progress}%` : it.status}</span>
              <div className="bar"><div style={{ width: `${it.progress}%` }} /></div>
              {it.error && <p className="error small">{it.error}</p>}
            </li>
          ))}
        </ul>
      )}

      {message && <p className="msg">{message}</p>}

      <div className="actions">
        {items.length > 0 && !busy && (
          <button className="btn ghost" onClick={() => setItems([])}>목록 비우기</button>
        )}
        <button className="btn" onClick={startUpload} disabled={busy || pending === 0}>
          {busy ? "업로드 중…" : `업로드 (${pending}장)`}
        </button>
      </div>
    </div>
  );
}
