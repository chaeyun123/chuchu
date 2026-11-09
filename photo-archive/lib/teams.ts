/** NC의 상대팀 목록 (클라이언트·서버 공용) */
export const TEAMS = ["삼성", "KT", "기아", "LG", "두산", "SSG", "롯데", "한화", "키움"] as const;
export type Team = (typeof TEAMS)[number];
export const isTeam = (s: unknown): s is Team => TEAMS.includes(s as Team);
