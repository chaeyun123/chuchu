"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 앨범(드라이브 폴더) 새로 만들기 — 업로드 권한 필요
export default function NewAlbum() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `오류 ${res.status}`);
      router.push(`/${encodeURIComponent(data.name)}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!open) {
    return <button className="btn ghost" onClick={() => setOpen(true)}>+ 새 앨범</button>;
  }
  return (
    <form className="new-album" onSubmit={create}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="앨범 이름 (예: 2026 개막전)"
        maxLength={100}
        required
        aria-label="새 앨범 이름"
      />
      <button className="btn" disabled={busy || !name.trim()}>{busy ? "만드는 중…" : "만들기"}</button>
      <button type="button" className="btn ghost" disabled={busy} onClick={() => { setOpen(false); setName(""); setError(""); }}>
        취소
      </button>
      {error && <p className="error new-album-error">{error}</p>}
    </form>
  );
}
