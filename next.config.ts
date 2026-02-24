import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
