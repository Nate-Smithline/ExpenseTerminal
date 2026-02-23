/**
 * Rate limiting for API routes.
 * Uses Upstash Redis when UPSTASH_REDIS_REST_URL is set; otherwise in-memory fallback (per-instance).
 */

const inMemoryStore = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  if (forwarded) return forwarded.split(",")[0].trim();
  if (realIp) return realIp;
  return "unknown";
}

export type RateLimitConfig = {
  limit: number;
  windowMs?: number;
  keyPrefix?: string;
};

async function checkInMemory(
  key: string,
  limit: number,
  windowMs: number
): Promise<{ success: boolean; remaining: number }> {
  const now = Date.now();
  const entry = inMemoryStore.get(key);
  if (!entry) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  if (now > entry.resetAt) {
    inMemoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { success: false, remaining: 0 };
  }
  return { success: true, remaining: limit - entry.count };
}

export async function rateLimitByIp(
  req: Request,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; limit: number }> {
  const { limit, windowMs = WINDOW_MS, keyPrefix = "rl" } = config;
  const id = getClientIdentifier(req);
  const key = `${keyPrefix}:${id}`;

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const windowStr = (windowMs >= 60000 ? `${windowMs / 60000} m` : `${windowMs / 1000} s`) as `${number} s` | `${number} m`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, windowStr),
        prefix: keyPrefix,
      });
      const res = await ratelimit.limit(key);
      return { success: res.success, remaining: res.remaining, limit: res.limit };
    } catch (e) {
      console.warn("[rate-limit] Upstash failed, using in-memory:", e);
    }
  }
  const { success, remaining } = await checkInMemory(key, limit, windowMs);
  return { success, remaining, limit };
}

/** 5 requests per 15 minutes per IP (e.g. email verification) */
export const emailVerificationLimit = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: "email-verify",
};

/** 3 requests per hour per identifier (e.g. password reset per email) */
export const passwordResetLimit = {
  limit: 3,
  windowMs: 60 * 60 * 1000,
  keyPrefix: "password-reset",
};

/** 5 attempts per hour (password change) */
export const passwordChangeLimit = {
  limit: 5,
  windowMs: 60 * 60 * 1000,
  keyPrefix: "password-change",
};

/** General API: 300 requests per minute per user/IP (inbox + many transaction cards trigger many GETs) */
export const generalApiLimit = {
  limit: 300,
  windowMs: 60 * 1000,
  keyPrefix: "api",
};

/** Expensive operations (analyze, export): 10 per hour per user */
export const expensiveOpLimit = {
  limit: 10,
  windowMs: 60 * 60 * 1000,
  keyPrefix: "expensive",
};

/** Rate limit by user ID or fallback to IP when no user */
export async function rateLimitForRequest(
  req: Request,
  userId: string | null,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; limit: number }> {
  const identifier = userId ?? getClientIdentifier(req);
  return rateLimitByIdentifier(identifier, config);
}

/** Rate limit by an arbitrary identifier (e.g. email for password reset) */
export async function rateLimitByIdentifier(
  identifier: string,
  config: RateLimitConfig
): Promise<{ success: boolean; remaining: number; limit: number }> {
  const { limit, windowMs = WINDOW_MS, keyPrefix = "rl" } = config;
  const key = `${keyPrefix}:${identifier}`;

  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      const { Ratelimit } = await import("@upstash/ratelimit");
      const { Redis } = await import("@upstash/redis");
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const windowStr = (windowMs >= 60000 ? `${windowMs / 60000} m` : `${windowMs / 1000} s`) as `${number} s` | `${number} m`;
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(limit, windowStr),
        prefix: keyPrefix,
      });
      const res = await ratelimit.limit(key);
      return { success: res.success, remaining: res.remaining, limit: res.limit };
    } catch (e) {
      console.warn("[rate-limit] Upstash failed, using in-memory:", e);
    }
  }
  const { success, remaining } = await checkInMemory(key, limit, windowMs);
  return { success, remaining, limit };
}
