/** @type {import('next').NextConfig} */
const nextConfig = {
  // shared 타입 계약을 워크스페이스에서 그대로 트랜스파일 (dist 빌드 의존 없이 소스 참조)
  transpilePackages: ["@mockspec/shared"],
};

export default nextConfig;
