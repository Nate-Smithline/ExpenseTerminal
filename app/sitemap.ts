import type { MetadataRoute } from "next";

// Publicly accessible routes (no login required).
// Includes marketing pages and auth flows, excludes app-internal dashboards/settings.
const PUBLIC_ROUTES = [
  "",
  "pricing",
  "request-demo",
  "signup",
  "login",
  "auth/forgot-password",
  "auth/reset-password",
  "auth/verify-pending",
  "privacy",
  "terms",
  "cookies",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://expenseterminal.com";

  return PUBLIC_ROUTES.map((path) => {
    const url = path ? `${baseUrl}/${path}` : baseUrl;
    return {
      url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: path === "" ? 1 : 0.7,
    };
  });
}

