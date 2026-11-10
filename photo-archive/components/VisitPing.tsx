"use client";

import { useEffect } from "react";

// 탭을 처음 열 때 한 번만 방문 기록을 보냅니다 (로그인 안 된 경우 서버가 무시).
export default function VisitPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("pa_visit")) return;
      sessionStorage.setItem("pa_visit", "1");
    } catch {}
    let page = location.pathname;
    try { page = decodeURIComponent(page); } catch {}
    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page }),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
