import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/lib/seo/site-url";

type PublicRoute = {
  path: string;
  changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"];
  priority: number;
};

// Publicly accessible routes (no login required).
const PUBLIC_ROUTES: PublicRoute[] = [
  { path: "", changeFrequency: "weekly", priority: 1 },
  { path: "#triage", changeFrequency: "weekly", priority: 0.9 },
  { path: "#mission", changeFrequency: "monthly", priority: 0.8 },
  { path: "#emails", changeFrequency: "monthly", priority: 0.7 },
  { path: "#quotes", changeFrequency: "monthly", priority: 0.7 },
  { path: "#features", changeFrequency: "weekly", priority: 0.9 },
  { path: "#pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "#faq", changeFrequency: "monthly", priority: 0.7 },
  { path: "#demo", changeFrequency: "monthly", priority: 0.8 },
  { path: "pricing", changeFrequency: "weekly", priority: 0.9 },
  { path: "request-demo", changeFrequency: "monthly", priority: 0.8 },
  { path: "signup", changeFrequency: "monthly", priority: 0.8 },
  { path: "login", changeFrequency: "monthly", priority: 0.6 },
  { path: "privacy", changeFrequency: "yearly", priority: 0.4 },
  { path: "terms", changeFrequency: "yearly", priority: 0.4 },
  { path: "cookies", changeFrequency: "yearly", priority: 0.4 },
  { path: "auth/forgot-password", changeFrequency: "yearly", priority: 0.3 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = getSiteUrl();

  return PUBLIC_ROUTES.map(({ path, changeFrequency, priority }) => ({
    url: path ? `${baseUrl}/${path}` : baseUrl,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));
}
