import { createHash, randomInt } from "crypto";
import { generateBibleToken } from "./bible-words";

/** Email verification OTP expiry (must match copy in email template). */
export const EMAIL_VERIFICATION_OTP_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Hash a token for storage (we never store the raw token).
 */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function generateSixDigitOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * 6-digit numeric code for email verification (signup / resend).
 */
export function createEmailOtp() {
  const token = generateSixDigitOtp();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_OTP_TTL_MS);
  return { token, tokenHash, expiresAt };
}

export function isSixDigitOtp(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/**
 * Generate a new verification token and its hash (word passphrase — password reset, etc.).
 * Returns { token, tokenHash, expiresAt }.
 */
export function createVerificationToken() {
  const token = generateBibleToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour — short expiry to limit token exposure
  return { token, tokenHash, expiresAt };
}
