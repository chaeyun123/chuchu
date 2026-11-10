"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `오류 ${res.status}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="locked">
      <form className="card login" onSubmit={submit}>
        <h1>관리자 확인</h1>
        <p className="muted">접속 기록은 관리자만 볼 수 있어요.</p>
        <label>
          관리자 비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "확인 중…" : "확인"}</button>
      </form>
    </main>
  );
}
