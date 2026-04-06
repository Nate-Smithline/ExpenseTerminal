/**
 * Build absolute URL for a published page link (owner UI + API responses).
 */
export function absoluteUrlForPublishedPage(req: Request, token: string): string {
  const path = `/p/${encodeURIComponent(token)}`;
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return `${explicit.replace(/\/$/, "")}${path}`;

  try {
    const u = new URL(req.url);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return `${u.protocol}//${u.host}${path}`;
    }
  } catch {
    /* fall through */
  }

  const origin = req.headers.get("origin") ?? req.headers.get("referer");
  if (origin) {
    try {
      const o = new URL(origin);
      return `${o.protocol}//${o.host}${path}`;
    } catch {
      /* fall through */
    }
  }

  return path;
}
