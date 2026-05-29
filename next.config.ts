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
      // Icon redirects
      { source: "/favicon.ico", destination: "/xt-icon.png", permanent: false },

      // App route redirects — old → new design routes
      { source: "/dashboard", destination: "/budget", permanent: false },
      { source: "/inbox", destination: "/review", permanent: false },
      { source: "/activity", destination: "/budget", permanent: false },
      { source: "/data-sources", destination: "/accounts", permanent: false },
      { source: "/data-sources/:path*", destination: "/accounts", permanent: false },
      { source: "/tax-details", destination: "/tax", permanent: false },
      { source: "/tax-details/:path*", destination: "/tax", permanent: false },
      { source: "/tax-filing", destination: "/tax", permanent: false },
      { source: "/tax-filing/:path*", destination: "/tax", permanent: false },
      { source: "/reports", destination: "/cashflow", permanent: false },
      { source: "/reports/:path*", destination: "/cashflow", permanent: false },
      { source: "/other-deductions", destination: "/tax", permanent: false },
      { source: "/deductions", destination: "/tax", permanent: false },
      { source: "/deductions/:path*", destination: "/tax", permanent: false },
      { source: "/preferences/rules", destination: "/settings/rules", permanent: false },
      { source: "/preferences/billing", destination: "/settings/billing", permanent: false },
      { source: "/preferences/profile", destination: "/settings/profile", permanent: false },
      { source: "/preferences/automations", destination: "/settings/rules", permanent: false },
      { source: "/preferences/:path*", destination: "/settings/profile", permanent: false },
      { source: "/rules", destination: "/settings/rules", permanent: false },
      { source: "/org-profile", destination: "/settings/profile", permanent: false },
    ];
  },
};

export default nextConfig;
