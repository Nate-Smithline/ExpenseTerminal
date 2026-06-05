import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from "plaid";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

export type PlaidEnv = "sandbox" | "development" | "production";

const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID ?? "";
const PLAID_SANDBOX_SECRET = process.env.PLAID_SANDBOX_SECRET ?? "";
const PLAID_PROD_SECRET = process.env.PLAID_PROD_SECRET ?? "";
const PLAID_ENV = (process.env.PLAID_ENV ?? "sandbox") as PlaidEnv;

/**
 * Resolve Plaid environment from hostname:
 * - localhost / 127.0.0.1 → honour PLAID_ENV (defaults to sandbox)
 * - any other host (e.g. expenseterminal.com) → always production
 */
export function getPlaidEnv(hostname?: string): PlaidEnv {
  const h = (hostname ?? "").toLowerCase().split(":")[0];
  const isLocal = h === "localhost" || h === "127.0.0.1" || h === "";

  if (!isLocal) return "production";

  const env = PLAID_ENV.toLowerCase();
  if (env === "production" || env === "development") return env;
  return "sandbox";
}

export function getPlaidClient(hostname?: string): PlaidApi {
  const env = getPlaidEnv(hostname);
  const secret = env === "sandbox" ? PLAID_SANDBOX_SECRET : PLAID_PROD_SECRET;
  if (!PLAID_CLIENT_ID || !secret) {
    throw new Error(
      env === "sandbox"
        ? "PLAID_CLIENT_ID and PLAID_SANDBOX_SECRET must be set"
        : "PLAID_CLIENT_ID and PLAID_PROD_SECRET must be set"
    );
  }
  const configuration = new Configuration({
    basePath: PlaidEnvironments[env],
    baseOptions: {
      headers: {
        "PLAID-CLIENT-ID": PLAID_CLIENT_ID,
        "PLAID-SECRET": secret,
      },
    },
  });
  return new PlaidApi(configuration);
}

export { Products as PlaidProducts, CountryCode as PlaidCountryCode };

// ---------------------------------------------------------------------------
// Error unwrapping
// ---------------------------------------------------------------------------

export interface PlaidErrorInfo {
  /** Best human-readable message (Plaid error_message → display_message → axios message). */
  message: string;
  error_type?: string;
  error_code?: string;
  error_message?: string;
  display_message?: string | null;
  request_id?: string;
  suggested_action?: string;
  /** HTTP status from the Plaid response, when available. */
  status?: number;
}

/**
 * Plaid uses axios under the hood; the useful error payload lives on
 * `error.response.data` ({ error_type, error_code, error_message, ... }), while
 * `error.message` is only the opaque "Request failed with status code 400".
 * This unwraps the real Plaid error so callers can surface error_code/message.
 */
export function extractPlaidError(e: unknown): PlaidErrorInfo {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const err = e as any;
  const data = err?.response?.data;
  const status = typeof err?.response?.status === "number" ? err.response.status : undefined;

  if (data && typeof data === "object") {
    const message =
      (data.error_message as string | undefined) ||
      (data.display_message as string | undefined) ||
      (err instanceof Error ? err.message : "Plaid request failed");
    return {
      message,
      error_type: data.error_type,
      error_code: data.error_code,
      error_message: data.error_message,
      display_message: data.display_message ?? null,
      request_id: data.request_id,
      suggested_action: data.suggested_action,
      status,
    };
  }

  return {
    message: err instanceof Error ? err.message : "Plaid request failed",
    status,
  };
}

// ---------------------------------------------------------------------------
// Access-token encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;

function deriveKey(): Buffer {
  const secret = process.env.PLAID_ACCESS_TOKEN_SECRET;
  if (!secret) throw new Error("PLAID_ACCESS_TOKEN_SECRET is not set");
  return scryptSync(secret, "plaid-at-salt", 32);
}

/**
 * Encrypt a Plaid access token for storage.
 * Returns a hex string: iv + ciphertext + authTag.
 */
export function encryptAccessToken(plaintext: string): string {
  const key = deriveKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString("hex");
}

/**
 * Decrypt a Plaid access token from storage.
 */
export function decryptAccessToken(hex: string): string {
  const key = deriveKey();
  const buf = Buffer.from(hex, "hex");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(buf.length - TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN, buf.length - TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf8");
}
