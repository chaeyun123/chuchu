import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 검색엔진 색인 차단
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
          // 외부 링크 클릭 시 주소(토큰 등)가 새지 않도록
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

export default nextConfig;
