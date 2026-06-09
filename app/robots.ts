import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getSiteUrl();

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/dashboard",
        "/budget",
        "/review",
        "/tax",
        "/accounts",
        "/cashflow",
        "/settings/",
        "/preferences/",
        "/onboarding",
        "/p/",
      ],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
