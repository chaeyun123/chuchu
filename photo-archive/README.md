# Photo Archive

Google Drive를 저장소 겸 DB로 쓰는 비공개 사진 아카이브입니다. **링크를 받은 사람만** 볼 수 있습니다.

- 사이트에 들어오면 먼저 **아이디/비밀번호**(`SITE_ID` / `SITE_PASSWORD`)를 입력해야 합니다. 주소가 공개된 곳에 올라가도 비밀번호 없이는 볼 수 없습니다.
- 로그인은 약 400일 유지됩니다. 앨범을 누르면 `https://내사이트/앨범명` 주소로 이동합니다.
- 로그인 성공/실패와 방문(탭을 열 때마다 1번)은 드라이브 루트 폴더의 `접속기록.csv`에 남고, 업로드 비밀번호로 로그인한 사람은 `/logs` 페이지에서 볼 수 있습니다.
- 웹에서 업로드하면 드라이브에 저장됩니다(업로드 비밀번호 필요).
- 원본 다운로드를 지원합니다.

## 드라이브 저장 구조 (= DB)

```
내 드라이브/
└ Photo Archive/              ← DRIVE_ROOT_FOLDER_ID
   ├ 2026 제주 여행/           ← 앨범 = 폴더 (폴더명이 곧 URL)
   │   ├ IMG_0001.jpg         ← 원본 그대로 저장
   │   └ ...                    appProperties: caption(설명), uploader(올린 사람)
   └ 가족 모임/                  appProperties: cover(대표 사진 ID)
```

촬영일, 가로/세로 크기는 드라이브가 사진의 EXIF 정보에서 자동으로 뽑아 주는 값을 씁니다.

---

## 설치 순서

### 1. Google Cloud 설정 (약 10분)

1. https://console.cloud.google.com 에서 새 프로젝트를 만듭니다.
2. **API 및 서비스 → 라이브러리**에서 **Google Drive API**를 찾아 **사용**을 누릅니다.
3. **Google 인증 플랫폼(OAuth 동의 화면)** 설정
   - 사용자 유형: **외부**
   - 앱 이름과 이메일은 아무거나 입력해도 됩니다.
   - 데이터 액세스(범위): `.../auth/drive.file` 추가
   - **⚠️ 게시 상태를 “프로덕션(In production)”으로 변경하세요.** “테스트” 상태로 두면 Refresh Token이 **7일마다 만료**되어 사이트가 멈춥니다. `drive.file`은 민감하지 않은 범위라서 구글 심사 없이 바로 쓸 수 있습니다.
4. **클라이언트 → 클라이언트 만들기**에서 유형을 **데스크톱 앱**으로 고르면 Client ID와 Secret이 나옵니다.

### 2. 프로젝트 설정

```bash
npm install
cp .env.example .env.local
```

`.env.local`에 `GOOGLE_CLIENT_ID`와 `GOOGLE_CLIENT_SECRET`을 넣고 아래를 실행합니다.

```bash
npm run setup:google
```

출력된 주소를 브라우저에서 열고, **사진을 저장할 구글 계정**으로 로그인합니다. 이때 “확인되지 않은 앱” 경고가 뜨면 **고급 → (앱 이름)(으)로 이동**을 누르면 됩니다. 내가 만든 앱이라 안전합니다.
완료되면 터미널에 출력되는 `GOOGLE_REFRESH_TOKEN`과 `DRIVE_ROOT_FOLDER_ID`를 `.env.local`에 붙여넣습니다.

나머지 값은 아래 명령으로 무작위 문자열을 만들어 채웁니다.

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

| 변수 | 설명 |
|---|---|
| `SITE_ID` / `SITE_PASSWORD` | 사이트 입장용 아이디와 비밀번호 |
| `UPLOAD_PASSWORD` | 업로드 비밀번호. 사진을 올릴 사람에게만 알려줍니다 |
| `COOKIE_SECRET` | 쿠키 서명용 |

### 3. 실행

```bash
npm run dev
# 브라우저에서 http://localhost:3000 → 아이디/비밀번호 입력
```

### 4. 배포 (Vercel 추천)

1. GitHub에 올립니다. `.env.local`은 `.gitignore`에 들어 있어 올라가지 않습니다.
2. https://vercel.com 에서 저장소를 Import하고, **Environment Variables**에 `.env.local`의 8개 값을 넣습니다.
3. 배포가 끝나면 `https://<도메인>` 주소와 아이디/비밀번호를 알려주면 됩니다.

> 직접 서버(`npm run build && npm start`)에서 돌릴 때는 HTTPS가 필요합니다. 쿠키에 Secure 속성이 붙기 때문입니다. localhost는 예외입니다.

---

## 알아두면 좋은 점

- **비밀번호를 바꾸고 싶을 때**: `SITE_ID`나 `SITE_PASSWORD`를 바꾸면 기존 로그인이 모두 풀립니다. `UPLOAD_PASSWORD`도 같은 방식으로 동작합니다.
- **사진 삭제나 이름 변경**: 구글 드라이브에서 직접 하면 됩니다. 사이트에는 1분 안에 반영됩니다.
- **드라이브에 직접 넣은 사진은 보이지 않습니다.** `drive.file` 권한은 이 앱이 만든 파일만 볼 수 있어서, 사진은 반드시 웹 업로드로 올려야 합니다. 대신 이 권한 덕분에 앱이 내 드라이브의 다른 파일에는 접근할 수 없습니다.
- **썸네일**: 서버가 원본을 줄여 WebP로 보여줍니다. 이 과정에서 위치정보 같은 EXIF가 제거됩니다. 원본 다운로드는 파일을 그대로 주므로 EXIF가 남아 있습니다.
- **아이폰 HEIC**: 브라우저에서 사진을 고르면 대부분 JPEG로 자동 변환됩니다. 변환되지 않은 HEIC는 썸네일이 표시되지 않을 수 있습니다.
- **용량**: 파일당 최대 200MB이고, 4MB씩 나눠 업로드하기 때문에 Vercel의 요청 크기 제한에 걸리지 않습니다.
- **비공개 장치**: 검색엔진 색인을 차단하고(`robots.txt`, `X-Robots-Tag`), Referrer를 차단합니다. 이미지는 브라우저 캐시만 허용해서 CDN을 통해 사진이 새지 않습니다.
