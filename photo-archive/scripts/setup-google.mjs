// 최초 1회 실행: Google 계정 연결(Refresh Token 발급) + 드라이브에 루트 폴더 생성
//   1) .env.local 에 GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET 을 먼저 넣고
//   2) npm run setup:google
//   3) 출력된 값을 .env.local 에 붙여넣기
import http from "node:http";
import fs from "node:fs";
import { OAuth2Client } from "google-auth-library";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

const { GOOGLE_CLIENT_ID: id, GOOGLE_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("❌ .env.local 에 GOOGLE_CLIENT_ID 와 GOOGLE_CLIENT_SECRET 을 먼저 넣어주세요.");
  process.exit(1);
}

const PORT = 53682;
const redirectUri = `http://127.0.0.1:${PORT}`;
const client = new OAuth2Client(id, secret, redirectUri);

// drive.file: 이 앱이 만든 파일/폴더에만 접근 (내 드라이브의 다른 파일은 못 봄)
const url = client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/drive.file"],
});

const server = http.createServer(async (req, res) => {
  const code = new URL(req.url, redirectUri).searchParams.get("code");
  if (!code) { res.end("code 없음"); return; }
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.refresh_token) throw new Error("refresh_token 이 없습니다. https://myaccount.google.com/permissions 에서 앱 권한을 삭제 후 다시 실행하세요.");
    client.setCredentials(tokens);

    let rootId = process.env.DRIVE_ROOT_FOLDER_ID;
    if (!rootId) {
      const r = await fetch("https://www.googleapis.com/drive/v3/files?fields=id", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Photo Archive", mimeType: "application/vnd.google-apps.folder" }),
      });
      if (!r.ok) throw new Error(`폴더 생성 실패: ${await r.text()}`);
      rootId = (await r.json()).id;
    }

    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end("<h2>✅ 완료! 터미널로 돌아가세요.</h2>");
    console.log("\n✅ 아래 두 줄을 .env.local 에 추가하세요:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log(`DRIVE_ROOT_FOLDER_ID=${rootId}`);
    console.log("\n(내 드라이브에 'Photo Archive' 폴더가 생겼습니다. 사진은 여기에 앨범 폴더별로 저장됩니다.)\n");
  } catch (e) {
    res.end("실패: " + e.message);
    console.error("❌", e.message);
  } finally {
    server.close();
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("\n아래 주소를 브라우저에서 열고, 사진을 저장할 Google 계정으로 로그인하세요:\n");
  console.log(url + "\n");
});
