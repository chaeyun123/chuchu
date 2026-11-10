"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// 로그인하지 않은 사람에게 보이는 입장 화면
export default function Locked() {
  const router = useRouter();
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `오류 ${res.status}`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <main className="locked">
      <form className="card login" onSubmit={submit}>
        <h1>입장하기</h1>
        <p className="muted">아이디와 비밀번호를 입력해 주세요.</p>
        <label>
          아이디
          <input value={id} onChange={(e) => setId(e.target.value)} autoComplete="username" autoCapitalize="none" required />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn" disabled={busy}>{busy ? "확인 중…" : "들어가기"}</button>
      </form>
    </main>
  );
}
