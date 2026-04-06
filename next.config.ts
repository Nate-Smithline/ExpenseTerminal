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
      { source: "/favicon.ico", destination: "/xt-icon.png", permanent: false },
      { source: "/apple-icon", destination: "/xt-icon.png", permanent: false },
      { source: "/other-deductions", destination: "/deductions", permanent: true },
      { source: "/deductions/qbi", destination: "/deductions", permanent: false },
    ];
  },
};

export default nextConfig;
