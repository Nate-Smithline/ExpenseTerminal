export const SIGNUP_FLOW_KEY = "signup_v1" as const;

export type SignupStage = 1 | 2 | 3 | 4 | 5 | 6;

export type SignupJtbdKey = "tax_walkthrough" | "deductions_export" | "set_aside" | "peace_of_mind";

export interface SignupV1Progress {
  stage: SignupStage;
  firstName: string;
  email: string;
  jtbd?: SignupJtbdKey | null;
  businessType?: string | null;
  filingStatus?: "single" | "married_filing_jointly" | null;
  expectedIncomeRange?: string | null;
  savingsEstimateUsd?: number | null;
  completedAt?: string | null;
  updatedAt: string;
}

export function localStorageKeyForEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  return `et_signup_onboarding:${SIGNUP_FLOW_KEY}:${normalized}`;
}

export function loadSignupDraft(email: string): Partial<SignupV1Progress> | null {
  if (typeof window === "undefined" || !email) return null;
  try {
    const raw = localStorage.getItem(localStorageKeyForEmail(email));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SignupV1Progress>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveSignupDraft(email: string, draft: Partial<SignupV1Progress>): void {
  if (typeof window === "undefined" || !email.trim()) return;
  try {
    const key = localStorageKeyForEmail(email);
    const prev = loadSignupDraft(email) ?? {};
    const next = {
      ...prev,
      ...draft,
      email: email.trim(),
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

export function mergeSignupProgress(
  fromProfile: unknown,
  fromLocal: Partial<SignupV1Progress> | null
): Partial<SignupV1Progress> | null {
  const p =
    fromProfile &&
    typeof fromProfile === "object" &&
    SIGNUP_FLOW_KEY in (fromProfile as Record<string, unknown>)
      ? ((fromProfile as Record<string, unknown>)[SIGNUP_FLOW_KEY] as Partial<SignupV1Progress>)
      : null;

  if (!p && !fromLocal) return null;
  if (!p) return fromLocal;
  if (!fromLocal) return p;

  const stage = Math.max(p.stage ?? 1, fromLocal.stage ?? 1) as SignupStage;
  return {
    ...fromLocal,
    ...p,
    stage,
    updatedAt: new Date().toISOString(),
  };
}
