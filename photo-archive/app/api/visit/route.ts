import { NextResponse, after } from "next/server";
import { getRole } from "@/lib/auth";
import { logAccess } from "@/lib/accessLog";

// 로그인된 사람이 사이트를 열 때(브라우저 탭마다 1번) 방문 기록을 남깁니다.
export async function POST(req: Request) {
  const role = await getRole();
  if (!role) return new NextResponse(null, { status: 204 });
  const { page } = await req.json().catch(() => ({ page: "" }));
  after(() => logAccess(req.headers, "방문", { id: role, page: typeof page === "string" ? page : "" }));
  return new NextResponse(null, { status: 204 });
}
