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
    return config;
  },
};

export default nextConfig;
