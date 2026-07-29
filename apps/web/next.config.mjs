/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mockspec/shared"],
  serverExternalPackages: ["express"],
  async rewrites() {
    return [
      {
        source: "/__mockspec/sdk.js",
        destination: "/reserved/mockspec-sdk",
      },
      {
        source: "/__mockspec/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    // `import x from "...?raw"` → 파일 내용을 문자열로 인라인.
    // 뷰어 런타임(packages/viewer/dist/main.js)을 산출물에 심을 때 쓴다. 런타임 fs 읽기를 하지
    // 않으므로 서버리스 파일 트레이싱·경로 해석에 의존하지 않는다 (lib/export/viewer-script.ts).
    config.module.rules.push({
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
};

export default nextConfig;
