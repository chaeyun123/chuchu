import { NextResponse } from "next/server";

// 예전 공유 링크(/s/...) 호환용: 이제 링크만으로는 들어올 수 없고, 홈의 로그인 화면으로 보냅니다.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/", req.url), 303);
}
