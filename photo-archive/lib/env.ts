function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`환경변수 ${name} 가 설정되지 않았습니다 (.env.local 확인)`);
  return v;
}

export const env = {
  get clientId() { return req("GOOGLE_CLIENT_ID"); },
  get clientSecret() { return req("GOOGLE_CLIENT_SECRET"); },
  get refreshToken() { return req("GOOGLE_REFRESH_TOKEN"); },
  get rootFolderId() { return req("DRIVE_ROOT_FOLDER_ID"); },
  get siteId() { return req("SITE_ID"); },
  get sitePassword() { return req("SITE_PASSWORD"); },
  get uploadPassword() { return req("UPLOAD_PASSWORD"); },
  get cookieSecret() { return req("COOKIE_SECRET"); },
};
