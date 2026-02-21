"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface OnboardingProgress {
  data_source?: boolean;
  upload_csv?: boolean;
  review_inbox?: boolean;
  setup_deductions?: boolean;
  org_profile?: boolean;
  skipped_all?: boolean;
}

const STEPS = [
  {
    id: "data_source" as const,
    label: "Add your first data source",
    description: "Connect a bank account or financial institution",
    href: "/data-sources",
    icon: "database",
  },
  {
    id: "upload_csv" as const,
    label: "Upload your first CSV",
    description: "Import transactions from your bank or accounting tool",
    href: "/inbox",
    icon: "upload_file",
  },
  {
    id: "review_inbox" as const,
    label: "Review transactions in Inbox",
    description: "AI categorizes each expense — confirm or adjust",
    href: "/inbox",
    icon: "inbox",
  },
  {
    id: "setup_deductions" as const,
    label: "Set up deductions",
    description: "Use calculators for QBI, mileage, home office, and more",
    href: "/other-deductions",
    icon: "savings",
  },
  {
    id: "org_profile" as const,
    label: "Configure org profile",
    description: "Add your business name, address, and filing type",
    href: "/org-profile",
    icon: "business",
  },
];

export function GettingStartedChecklist() {
  const [progress, setProgress] = useState<OnboardingProgress>({});
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((body) => {
        const p = body.data?.onboarding_progress ?? {};
        setProgress(typeof p === "object" && p !== null ? p : {});
        if (p?.skipped_all) setDismissed(true);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function updateProgress(next: OnboardingProgress) {
    setProgress(next);
    await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboarding_progress: next }),
    });
  }

  function toggleStep(id: keyof OnboardingProgress) {
    const next = { ...progress, [id]: !progress[id] };
    updateProgress(next);
  }

  function skipStep(id: keyof OnboardingProgress) {
    const next = { ...progress, [id]: true };
    updateProgress(next);
  }

  function skipAll() {
    const next: OnboardingProgress = { skipped_all: true };
    for (const s of STEPS) next[s.id] = true;
    updateProgress(next);
    setDismissed(true);
  }

  if (loading || dismissed) return null;

  const completedCount = STEPS.filter((s) => progress[s.id]).length;
  const allDone = completedCount === STEPS.length;

  if (allDone) return null;

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-mono-dark">Getting Started</h2>
          <p className="text-xs text-mono-light mt-0.5">
            {completedCount} of {STEPS.length} complete
          </p>
        </div>
        <button
          onClick={skipAll}
          className="text-xs text-mono-light hover:text-mono-medium transition-colors"
        >
          Skip all
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-bg-tertiary/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-sage rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step) => {
          const done = !!progress[step.id];
          return (
            <div
              key={step.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all ${
                done ? "bg-bg-secondary/60" : "bg-white border border-bg-tertiary/30"
              }`}
            >
              <button
                onClick={() => toggleStep(step.id)}
                className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                  done
                    ? "bg-accent-sage border-accent-sage"
                    : "border-bg-tertiary hover:border-accent-sage/40"
                }`}
              >
                {done && (
                  <span className="material-symbols-rounded text-white text-[14px]">check</span>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium ${done ? "text-mono-light line-through" : "text-mono-dark"}`}>
                  {step.label}
                </p>
                {!done && (
                  <p className="text-xs text-mono-light mt-0.5">{step.description}</p>
                )}
              </div>

              {!done && (
                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={step.href}
                    className="text-xs text-accent-sage font-medium hover:underline"
                  >
                    Go
                  </Link>
                  <button
                    onClick={() => skipStep(step.id)}
                    className="text-xs text-mono-light hover:text-mono-medium transition-colors"
                  >
                    Skip
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
