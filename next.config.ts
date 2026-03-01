import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow large CSV upload batches (client sends in chunks; each chunk can have long vendor/description)
    proxyClientMaxBodySize: "50mb",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/favicon.ico", destination: "/icon.png", permanent: false },
      { source: "/apple-icon", destination: "/icon.png", permanent: false },
    ];
  },
};

export default nextConfig;
