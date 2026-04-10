"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type NotificationOption = { label: string; type: "count_based" | "interval_based" | "never"; value: string };

const NOTIFICATION_OPTIONS: NotificationOption[] = [
  { label: "50 transactions", type: "count_based", value: "50" },
  { label: "100 transactions", type: "count_based", value: "100" },
  { label: "250 transactions", type: "count_based", value: "250" },
  { label: "1000 transactions", type: "count_based", value: "1000" },
  { label: "Weekly", type: "interval_based", value: "weekly" },
  { label: "Monthly", type: "interval_based", value: "monthly" },
  { label: "Quarterly", type: "interval_based", value: "quarterly" },
  { label: "Never", type: "never", value: "never" },
];

type OnboardingProgress = {
  notification_frequency?: boolean;
  consultation_choice?: "yes" | "no";
  upload_data_source?: boolean;
  set_pages?: boolean;
  create_columns?: boolean;
  set_rule?: boolean;
};

type StepId = keyof OnboardingProgress;

const STEP_ORDER: StepId[] = [
  "notification_frequency",
  "consultation_choice",
  "upload_data_source",
  "set_pages",
  "create_columns",
  "set_rule",
];

function StepDone({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.06] bg-[#f5f5f7]/70 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="material-symbols-rounded shrink-0 text-[#34c759]"
          style={{ fontSize: 18, fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
          aria-hidden
        >
          check_circle
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-mono-dark">{label}</span>
      </div>
      <span className="shrink-0 text-xs font-medium text-black/60 tabular-nums">{value}</span>
    </div>
  );
}

export function GettingStartedChecklist({
  setupStatus,
}: {
  setupStatus?: Partial<Record<StepId, boolean>>;
  taxYear: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [savingStep, setSavingStep] = useState<StepId | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [notificationPrefKey, setNotificationPrefKey] = useState<string | null>(null);

  const [dataSourcesCount, setDataSourcesCount] = useState<number>(0);
  const [pagesCount, setPagesCount] = useState<number>(0);
  const [propertiesCount, setPropertiesCount] = useState<number>(0);
  const [rulesCount, setRulesCount] = useState<number>(0);

  const [toast, setToast] = useState<string | null>(null);

  const refreshSignals = useCallback(async () => {
    const [profileBody, notifBody, dsBody, pagesBody, propsBody, rulesBody] = await Promise.all([
      fetch("/api/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/notification-preferences").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/data-sources").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/pages").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/org/transaction-properties").then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch("/api/org/rules").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    const p = profileBody?.data?.onboarding_progress ?? {};
    setProgress(typeof p === "object" && p !== null ? p : {});

    const pref = notifBody?.data ?? notifBody ?? null;
    if (pref?.type && pref?.value) setNotificationPrefKey(`${pref.type}:${pref.value}`);

    const ds = Array.isArray(dsBody?.data) ? dsBody.data.length : 0;
    setDataSourcesCount(ds);

    const pages = Array.isArray(pagesBody?.pages) ? pagesBody.pages.length : 0;
    setPagesCount(pages);

    const props = Array.isArray(propsBody?.properties) ? propsBody.properties.length : 0;
    setPropertiesCount(props);

    const rules = Array.isArray(rulesBody?.rules) ? rulesBody.rules.length : 0;
    setRulesCount(rules);
  }, []);

  useEffect(() => {
    refreshSignals().finally(() => setLoading(false));
  }, [refreshSignals]);

  const updateProgress = useCallback(async (next: OnboardingProgress) => {
    setProgress(next);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_progress: next }),
    });
  }, []);

  const notifLabel = useMemo(() => {
    if (!notificationPrefKey) return "";
    return (
      NOTIFICATION_OPTIONS.find((o) => `${o.type}:${o.value}` === notificationPrefKey)?.label ??
      notificationPrefKey
    );
  }, [notificationPrefKey]);

  function isStepDone(id: StepId): boolean {
    if (setupStatus?.[id]) return true;
    if (id === "notification_frequency") return !!notificationPrefKey || !!progress.notification_frequency;
    if (id === "consultation_choice") return progress.consultation_choice === "yes" || progress.consultation_choice === "no";
    if (id === "upload_data_source") return (dataSourcesCount ?? 0) > 0 || !!progress.upload_data_source;
    if (id === "set_pages") return (pagesCount ?? 0) >= 3 || !!progress.set_pages;
    if (id === "create_columns") return (propertiesCount ?? 0) >= 2 || !!progress.create_columns;
    if (id === "set_rule") return (rulesCount ?? 0) >= 1 || !!progress.set_rule;
    return Boolean(progress[id]);
  }

  function isUnlocked(id: StepId): boolean {
    const idx = STEP_ORDER.indexOf(id);
    if (idx <= 0) return true;
    return STEP_ORDER.slice(0, idx).every((stepId) => isStepDone(stepId));
  }

  const completedCount = STEP_ORDER.filter((id) => isStepDone(id)).length;
  const allDone = completedCount === STEP_ORDER.length;

  async function markDone(patch: Partial<OnboardingProgress>) {
    const next = { ...progress, ...patch };
    await updateProgress(next);
  }

  const createPage = useCallback(
    async (title: string) => {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((body as { error?: string }).error ?? "Failed to create page");
      }
      const pageId = (body as { page?: { id?: string } }).page?.id;
      if (pageId) router.push(`/pages/${pageId}`);
    },
    [router],
  );

  const quickCreateProperty = useCallback(async (args: { name: string; type: string }) => {
    const res = await fetch("/api/org/transaction-properties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: args.name, type: args.type }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error((body as { error?: string }).error ?? "Failed to create column");
    }
  }, []);

  if (loading) return null;

  if (allDone) {
    return (
      <section className="rounded-3xl border border-black/[0.06] bg-white shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setCompletedExpanded((v) => !v)}
          className="w-full px-5 py-4 flex items-start gap-3 text-left transition-colors bg-[radial-gradient(circle_at_15%_0%,rgba(0,122,255,0.14),transparent_55%),radial-gradient(circle_at_85%_0%,rgba(98,186,70,0.12),transparent_58%),linear-gradient(#ffffff,#ffffff)] hover:bg-[#f5f5f7]/60"
        >
          <span
            className="material-symbols-rounded shrink-0 mt-0.5 text-[#34c759]"
            style={{ fontSize: 22, fontVariationSettings: "'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24" }}
            aria-hidden
          >
            check_circle
          </span>
          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white/70 px-3 py-1 text-[11px] font-semibold tracking-wide text-black/60">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#007aff]" aria-hidden />
              Onboarding complete
            </div>
            <div role="heading" aria-level={2} className="mt-2 text-base md:text-lg font-semibold font-sans text-mono-dark tracking-tight">
              You&apos;re all set
            </div>
            <p className="text-xs text-mono-medium mt-1 font-sans">
              All {STEP_ORDER.length} setup steps are complete.
            </p>
          </div>
          <span
            className="material-symbols-rounded text-mono-light shrink-0 mt-1 transition-transform"
            style={{
              fontSize: 22,
              transform: completedExpanded ? "rotate(180deg)" : undefined,
            }}
          >
            expand_more
          </span>
        </button>
        {completedExpanded ? (
          <div className="px-5 py-4 space-y-2 border-t border-black/[0.06] bg-[#f5f5f7]/50">
            {isStepDone("notification_frequency") ? <StepDone label="Notifications" value={notifLabel || "Set"} /> : null}
            {isStepDone("consultation_choice") ? (
              <StepDone label="Consultation" value={progress.consultation_choice === "yes" ? "Requested" : "No thanks"} />
            ) : null}
            {isStepDone("upload_data_source") ? <StepDone label="Accounts" value={`${Math.max(1, dataSourcesCount)} added`} /> : null}
            {isStepDone("set_pages") ? <StepDone label="Pages" value={`${Math.max(3, pagesCount)} created`} /> : null}
            {isStepDone("create_columns") ? <StepDone label="Columns" value={`${Math.max(2, propertiesCount)} created`} /> : null}
            {isStepDone("set_rule") ? <StepDone label="Rules" value={`${Math.max(1, rulesCount)} created`} /> : null}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-black/[0.06] bg-white divide-y divide-black/[0.06] shadow-sm overflow-hidden">
      <div className="px-5 py-4">
        <div role="heading" aria-level={2} className="text-base md:text-lg font-normal font-sans text-mono-dark">
          Start here
        </div>
        <p className="text-xs text-mono-medium mt-1 font-sans">
          {completedCount} of {STEP_ORDER.length} action steps complete.
        </p>
        {toast ? <p className="mt-2 text-xs text-mono-medium">{toast}</p> : null}
      </div>

      <div className="px-5 py-4 space-y-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-black/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#007aff] transition-all duration-300"
              style={{ width: `${(completedCount / STEP_ORDER.length) * 100}%` }}
            />
          </div>
          <span className="text-[11px] tabular-nums font-medium text-mono-medium shrink-0">
            {Math.round((completedCount / STEP_ORDER.length) * 100)}%
          </span>
        </div>

        <div className="space-y-4">
          {/* STEP 1 — Notification frequency */}
          <div className={`py-1 ${!isUnlocked("notification_frequency") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 1</p>
            {isStepDone("notification_frequency") ? (
              <StepDone label="Notifications" value={notifLabel || "Set"} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">How often would you like to get notified?</p>
                <p className="text-xs text-mono-medium mt-1">We&apos;ll check in so you can stay in the loop</p>
                <div className="mt-2 overflow-x-auto">
                  <div className="inline-flex items-center gap-2 whitespace-nowrap pb-1">
                    {NOTIFICATION_OPTIONS.map((option) => {
                      const key = `${option.type}:${option.value}`;
                      return (
                        <button
                          key={key}
                          type="button"
                          disabled={savingStep === "notification_frequency"}
                          onClick={async () => {
                            setSavingStep("notification_frequency");
                            try {
                              const res = await fetch("/api/notification-preferences", {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ type: option.type, value: option.value }),
                              });
                              if (!res.ok) return;
                              setNotificationPrefKey(key);
                              await markDone({ notification_frequency: true });
                            } finally {
                              setSavingStep(null);
                            }
                          }}
                          className="px-3 py-2 text-xs font-medium rounded-full transition-colors bg-[#f5f5f7] text-mono-dark hover:bg-black/[0.06]"
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* STEP 2 — Consultation */}
          <div className={`py-1 border-t border-black/[0.06] ${!isUnlocked("consultation_choice") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 2</p>
            {isStepDone("consultation_choice") ? (
              <StepDone
                label="Consultation"
                value={progress.consultation_choice === "yes" ? "Requested" : "No thanks"}
              />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Would you like a free consultation?</p>
                <p className="text-xs text-mono-medium mt-1">
                  If you say yes, we&apos;ll email you to schedule time.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingStep === "consultation_choice"}
                    onClick={async () => {
                      setSavingStep("consultation_choice");
                      try {
                        const res = await fetch("/api/email/request-consultation", { method: "POST" });
                        const body = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setToast((body as { error?: string }).error ?? "Could not send request");
                          setTimeout(() => setToast(null), 4000);
                          return;
                        }
                        await markDone({ consultation_choice: "yes" });
                        setToast("Request sent. We’ll reach out soon.");
                        setTimeout(() => setToast(null), 4000);
                      } finally {
                        setSavingStep(null);
                      }
                    }}
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-[#007aff] text-white rounded-full hover:bg-[#0066d6] transition-colors"
                  >
                    Yes, please
                  </button>
                  <button
                    type="button"
                    disabled={savingStep === "consultation_choice"}
                    onClick={async () => {
                      setSavingStep("consultation_choice");
                      try {
                        await markDone({ consultation_choice: "no" });
                      } finally {
                        setSavingStep(null);
                      }
                    }}
                    className="px-4 py-2.5 text-sm font-medium font-sans bg-[#f5f5f7] text-mono-dark rounded-full hover:bg-black/[0.06] transition-colors"
                  >
                    No thanks
                  </button>
                </div>
              </>
            )}
          </div>

          {/* STEP 3 — Upload first data source */}
          <div className={`py-1 border-t border-black/[0.06] ${!isUnlocked("upload_data_source") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 3</p>
            {isStepDone("upload_data_source") ? (
              <StepDone label="Accounts" value={`${Math.max(1, dataSourcesCount)} added`} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Upload your first data source</p>
                <p className="text-xs text-mono-medium mt-1">
                  Add an account and upload a CSV to get transactions flowing.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href="/data-sources?add=1"
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-full hover:bg-black/85 transition-colors"
                  >
                    Add account
                  </Link>
                  <button
                    type="button"
                    className="text-xs text-[#007aff] font-medium hover:underline"
                    onClick={() => {
                      void refreshSignals();
                    }}
                  >
                    Refresh status
                  </button>
                </div>
              </>
            )}
          </div>

          {/* STEP 4 — Set first 3 pages */}
          <div className={`py-1 border-t border-black/[0.06] ${!isUnlocked("set_pages") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 4</p>
            {isStepDone("set_pages") ? (
              <StepDone label="Pages" value={`${Math.max(3, pagesCount)} created`} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Set your first 3 pages</p>
                <p className="text-xs text-mono-medium mt-1">
                  Inspiration: “Client projects”, “Reimbursements”, “Subscriptions”, “Tax prep”.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["Client projects", "Subscriptions", "Tax prep"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      disabled={savingStep === "set_pages"}
                      onClick={async () => {
                        setSavingStep("set_pages");
                        try {
                          await createPage(t);
                        } catch (e) {
                          setToast(e instanceof Error ? e.message : "Failed to create page");
                          setTimeout(() => setToast(null), 4000);
                        } finally {
                          setSavingStep(null);
                          void refreshSignals();
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium rounded-full transition-colors bg-[#f5f5f7] text-mono-dark hover:bg-black/[0.06]"
                    >
                      + {t}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="px-3 py-2 text-xs font-medium rounded-full transition-colors bg-white border border-black/[0.06] text-mono-dark hover:bg-black/[0.03]"
                    onClick={() => void refreshSignals()}
                  >
                    Refresh
                  </button>
                </div>
                <p className="mt-2 text-xs text-mono-light">Currently: {pagesCount} page(s).</p>
              </>
            )}
          </div>

          {/* STEP 5 — Create columns */}
          <div className={`py-1 border-t border-black/[0.06] ${!isUnlocked("create_columns") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 5</p>
            {isStepDone("create_columns") ? (
              <StepDone label="Columns" value={`${Math.max(2, propertiesCount)} created`} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Create your first 2 additional columns</p>
                <p className="text-xs text-mono-medium mt-1">
                  Inspiration: “Client”, “Project”, “Receipt link”, “VAT”, “Reimbursable”.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { name: "Client", type: "short_text" },
                    { name: "Project", type: "short_text" },
                    { name: "Receipt link", type: "short_text" },
                  ].map((c) => (
                    <button
                      key={c.name}
                      type="button"
                      disabled={savingStep === "create_columns"}
                      onClick={async () => {
                        setSavingStep("create_columns");
                        try {
                          await quickCreateProperty(c);
                          setToast(`Created column: ${c.name}`);
                          setTimeout(() => setToast(null), 2500);
                        } catch (e) {
                          setToast(e instanceof Error ? e.message : "Failed to create column");
                          setTimeout(() => setToast(null), 4000);
                        } finally {
                          setSavingStep(null);
                          void refreshSignals();
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium rounded-full transition-colors bg-[#f5f5f7] text-mono-dark hover:bg-black/[0.06]"
                    >
                      + {c.name}
                    </button>
                  ))}
                  <Link
                    href="/activity"
                    className="px-3 py-2 text-xs font-medium rounded-full transition-colors bg-white border border-black/[0.06] text-mono-dark hover:bg-black/[0.03]"
                  >
                    Manage in table
                  </Link>
                </div>
                <p className="mt-2 text-xs text-mono-light">Currently: {propertiesCount} column(s).</p>
              </>
            )}
          </div>

          {/* STEP 6 — Set first rule */}
          <div className={`py-1 border-t border-black/[0.06] ${!isUnlocked("set_rule") ? "opacity-50 pointer-events-none" : ""}`}>
            <p className="text-[11px] font-semibold tracking-wide text-mono-light">STEP 6</p>
            {isStepDone("set_rule") ? (
              <StepDone label="Rules" value={`${Math.max(1, rulesCount)} created`} />
            ) : (
              <>
                <p className="text-sm font-medium text-mono-dark mt-1">Set your first rule</p>
                <p className="text-xs text-mono-medium mt-1">
                  Inspiration: “If vendor contains Uber → Travel”, “If amount &lt; $10 → ignore”, “If memo contains Stripe → Software”.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Link
                    href="/rules"
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium font-sans bg-black text-white rounded-full hover:bg-black/85 transition-colors"
                  >
                    Create a rule
                  </Link>
                  <button
                    type="button"
                    className="text-xs text-[#007aff] font-medium hover:underline"
                    onClick={() => void refreshSignals()}
                  >
                    Refresh status
                  </button>
                </div>
                <p className="mt-2 text-xs text-mono-light">Currently: {rulesCount} rule(s).</p>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
