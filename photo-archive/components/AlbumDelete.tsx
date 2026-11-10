"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AlbumDelete({ id, name, count }: { id: string; name: string; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const msg = count
      ? `‘${name}’ 앨범과 안의 사진 ${count}장을 모두 삭제할까요?`
      : `‘${name}’ 앨범을 삭제할까요?`;
    if (!confirm(`${msg}\n(Google Drive 휴지통으로 옮겨지며 30일 안에 복구할 수 있어요)`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/albums/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      router.push("/albums");
      router.refresh();
    } catch {
      alert("앨범을 삭제하지 못했어요.");
      setBusy(false);
    }
  }

  return (
    <button className="btn ghost small danger-text" onClick={remove} disabled={busy}>
      {busy ? "삭제 중…" : "앨범 삭제"}
    </button>
  );
}
