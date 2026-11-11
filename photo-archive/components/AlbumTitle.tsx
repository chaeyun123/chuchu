"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 앨범 제목 + 이름 바꾸기 (업로드 권한이 있을 때만 버튼 표시)
export default function AlbumTitle({ id, name, canEdit }: { id: string; name: string; canEdit: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim() === name) return setEditing(false);
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/albums/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
      // 이름이 곧 주소라서 새 주소로 이동
      router.replace(`/${encodeURIComponent(data.name)}?id=${data.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="album-title">
        <h1>{name}</h1>
        {canEdit && (
          <button className="rename-btn" onClick={() => { setValue(name); setEditing(true); }} aria-label="앨범 이름 바꾸기" title="이름 바꾸기">
            ✎
          </button>
        )}
      </div>
    );
  }
  return (
    <form className="new-album rename-form" onSubmit={save}>
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        maxLength={100}
        required
        aria-label="새 앨범 이름"
      />
      <button className="btn" disabled={busy || !value.trim()}>{busy ? "바꾸는 중…" : "저장"}</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => { setEditing(false); setError(""); }}>취소</button>
      {error && <p className="error new-album-error">{error}</p>}
    </form>
  );
}
