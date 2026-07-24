/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@mockspec/shared"],
  serverExternalPackages: ["express"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};

export default nextConfig;
