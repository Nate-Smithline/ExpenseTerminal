"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const HUSTLE_TYPES = ["Freelance", "Gig work", "Creator", "E‑commerce", "Something else"] as const;

type WorkspaceRow = { id: string; name: string };

function setWorkspaceCookie(id: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `et_workspace=${encodeURIComponent(id)}; path=/; max-age=${maxAge}`;
}

export function GuidedSetupWizard() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [hustle, setHustle] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const [homeOfficeOn, setHomeOfficeOn] = useState(false);
  const [mileageOn, setMileageOn] = useState(false);
  const [workspaceSqFt, setWorkspaceSqFt] = useState(150);
  const [totalHomeSqFt, setTotalHomeSqFt] = useState(1200);
  const [monthlyRent, setMonthlyRent] = useState(800);
  const [monthlyUtilities, setMonthlyUtilities] = useState(0);
  const [miles, setMiles] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await fetch("/api/workspaces");
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json.data) ? (json.data as any[]) : [];
      const mapped = list.map((w) => ({ id: String(w.id), name: String(w.name) }));
      if (!alive) return;
      setWorkspaces(mapped);
      if (!workspaceId && mapped.length > 0) {
        setWorkspaceId(mapped[0]!.id);
        setWorkspaceCookie(mapped[0]!.id);
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspaceId]);

  async function persistProgress(extra: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", { method: "GET" });
      const body = await res.json().catch(() => ({}));
      const current =
        body?.data?.onboarding_progress && typeof body.data.onboarding_progress === "object"
          ? body.data.onboarding_progress
          : {};
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboarding_progress: { ...current, ...extra, onboarding_flow: "plans_v1", completed_steps: step + 1 },
        }),
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveComputedDeductions() {
    if (!workspaceId) return;
    const headers = { "Content-Type": "application/json", "x-workspace-id": workspaceId };
    if (homeOfficeOn) {
      await fetch("/api/deductions/compute", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "home_office",
          tax_year: new Date().getFullYear(),
          workspace_sq_ft: workspaceSqFt,
          total_home_sq_ft: totalHomeSqFt,
          monthly_rent: monthlyRent,
          monthly_utilities: monthlyUtilities,
        }),
      });
    }
    if (mileageOn) {
      await fetch("/api/deductions/compute", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: "mileage",
          tax_year: new Date().getFullYear(),
          miles,
        }),
      });
    }
  }

  async function next() {
    if (step === 0) {
      if (workspaceId) setWorkspaceCookie(workspaceId);
      if (hustle) await persistProgress({ business_type_label: hustle });
    }
    if (step === 1) {
      await saveComputedDeductions();
    }
    if (step < 3) {
      setStep((s) => s + 1);
      return;
    }
    await persistProgress({ completed_at: new Date().toISOString() });
    router.push("/dashboard");
  }

  function back() {
    setStep((s) => Math.max(0, s - 1));
  }

  const canContinue = useMemo(() => {
    if (saving) return false;
    if (step === 0) return !!hustle && !!workspaceId;
    return true;
  }, [saving, step, hustle, workspaceId]);

  return (
    <div className="max-w-lg mx-auto px-5 py-14">
      <div className="flex gap-2 mb-10">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-200 ease-out ${
              i <= step ? "bg-sovereign-blue" : "bg-frost"
            }`}
          />
        ))}
      </div>

      {toast && (
        <div className="mb-6 rounded-2xl border border-cool-stock bg-bg-primary px-4 py-3 text-sm text-mono-medium">
          {toast}
        </div>
      )}

      {step === 0 && (
        <section className="space-y-6">
          <div className="space-y-2">
            <h1 className="font-display text-2xl md:text-3xl text-mono-dark">What kind of work do you do?</h1>
            <p className="text-sm text-mono-medium">We use this to tune suggestions — you can change it anytime.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium text-mono-medium uppercase tracking-wider">Workspace</p>
            <div className="flex gap-2">
              <select
                className="w-full rounded-2xl border border-frost bg-bg-primary px-3 py-3 text-sm text-mono-dark outline-none transition-colors duration-150"
                value={workspaceId ?? ""}
                onChange={(e) => {
                  setWorkspaceId(e.target.value);
                  setWorkspaceCookie(e.target.value);
                }}
              >
                {workspaces.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rounded-2xl border border-frost bg-bg-primary px-4 text-sm font-medium text-mono-dark transition-colors duration-150 hover:border-sovereign-blue/30"
                onClick={async () => {
                  const name = prompt("Workspace name");
                  if (!name?.trim()) return;
                  const res = await fetch("/api/workspaces", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: name.trim() }),
                  });
                  const ws = await res.json().catch(() => null);
                  if (!ws?.id) return;
                  const nextWs = { id: String(ws.id), name: String(ws.name ?? name) };
                  setWorkspaces((prev) => [nextWs, ...prev]);
                  setWorkspaceId(nextWs.id);
                  setWorkspaceCookie(nextWs.id);
                }}
              >
                New
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {HUSTLE_TYPES.map((label) => (
              <button
                key={label}
                type="button"
                onClick={() => setHustle(label)}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition-all duration-150 ease-out ${
                  hustle === label
                    ? "border-sovereign-blue bg-sovereign-blue/5 text-mono-dark ring-2 ring-sovereign-blue/20"
                    : "border-frost bg-bg-primary hover:border-sovereign-blue/30"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <div className="space-y-2">
            <h1 className="font-display text-2xl md:text-3xl text-mono-dark">
              Let&apos;s find every deduction — not just card transactions
            </h1>
            <p className="text-sm text-mono-medium leading-relaxed">
              Check anything that applies. We&apos;ll save what you enter and calculate amounts automatically.
            </p>
          </div>

          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium text-mono-dark">
              <input type="checkbox" checked={homeOfficeOn} onChange={(e) => setHomeOfficeOn(e.target.checked)} />
              I work from home
            </label>
            {homeOfficeOn && (
              <div className="grid grid-cols-1 gap-2 rounded-2xl border border-frost bg-bg-primary p-4">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-xl border border-frost px-3 py-2 text-sm"
                    type="number"
                    value={workspaceSqFt}
                    onChange={(e) => setWorkspaceSqFt(Number(e.target.value))}
                    placeholder="Workspace sq ft"
                  />
                  <input
                    className="rounded-xl border border-frost px-3 py-2 text-sm"
                    type="number"
                    value={totalHomeSqFt}
                    onChange={(e) => setTotalHomeSqFt(Number(e.target.value))}
                    placeholder="Total home sq ft"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    className="rounded-xl border border-frost px-3 py-2 text-sm"
                    type="number"
                    value={monthlyRent}
                    onChange={(e) => setMonthlyRent(Number(e.target.value))}
                    placeholder="Monthly rent"
                  />
                  <input
                    className="rounded-xl border border-frost px-3 py-2 text-sm"
                    type="number"
                    value={monthlyUtilities}
                    onChange={(e) => setMonthlyUtilities(Number(e.target.value))}
                    placeholder="Monthly utilities (optional)"
                  />
                </div>
                <p className="text-xs text-mono-light">
                  We&apos;ll compute both IRS methods and keep whichever is larger.
                </p>
              </div>
            )}

            <label className="flex items-center gap-2 text-sm font-medium text-mono-dark">
              <input type="checkbox" checked={mileageOn} onChange={(e) => setMileageOn(e.target.checked)} />
              I drive for work
            </label>
            {mileageOn && (
              <div className="rounded-2xl border border-frost bg-bg-primary p-4 space-y-2">
                <input
                  className="w-full rounded-xl border border-frost px-3 py-2 text-sm"
                  type="number"
                  value={miles}
                  onChange={(e) => setMiles(Number(e.target.value))}
                  placeholder="Estimated business miles this year"
                />
                <p className="text-xs text-mono-light">We&apos;ll use the IRS rate for the year.</p>
              </div>
            )}
          </div>

          <p className="text-xs text-mono-light">
            You can add phone, internet, health insurance, and more later under{" "}
            <Link href="/other-deductions" className="text-sovereign-blue font-medium hover:underline">
              Other deductions
            </Link>
            .
          </p>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h1 className="font-display text-2xl md:text-3xl text-mono-dark">Connect your bank account</h1>
          <p className="text-sm text-mono-medium leading-relaxed">
            We&apos;ll scan transactions and suggest potential write-offs. Takes about 60 seconds.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/data-sources"
              className="btn-primary rounded-2xl w-fit"
              onClick={() => {
                if (workspaceId) setWorkspaceCookie(workspaceId);
              }}
            >
              Connect via Plaid
            </Link>
            <Link href="/data-sources" className="text-sm text-sovereign-blue font-medium hover:underline w-fit">
              Upload a CSV instead
            </Link>
            <p className="text-xs text-mono-light">Bank-level encryption · Disconnect anytime</p>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="space-y-4">
          <h1 className="font-display text-2xl md:text-3xl text-mono-dark">First scan result</h1>
          <p className="text-sm text-mono-medium leading-relaxed">
            When you sync transactions, we can auto-clean names and suggest categories.
          </p>
          <button
            type="button"
            className="btn-secondary rounded-2xl w-fit"
            onClick={async () => {
              if (!workspaceId) return;
              setToast("Scanning recent transactions…");
              const params = new URLSearchParams({ limit: "200", sort_by: "date", sort_order: "desc" });
              const listRes = await fetch(`/api/transactions?${params.toString()}`, {
                headers: { "x-workspace-id": workspaceId },
              });
              const listBody = await listRes.json().catch(() => ({}));
              const ids = Array.isArray(listBody.data) ? listBody.data.map((t: any) => t.id).filter(Boolean) : [];
              if (ids.length === 0) {
                setToast("No transactions yet. Connect an account first.");
                return;
              }
              const enrichRes = await fetch("/api/transactions/enrich", {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-workspace-id": workspaceId },
                body: JSON.stringify({ transactionIds: ids }),
              });
              const enrichBody = await enrichRes.json().catch(() => ({}));
              setToast(`Scan complete: ${enrichBody.categorized ?? 0} categorized.`);
              setTimeout(() => setToast(null), 4000);
            }}
          >
            Run first scan
          </button>
          <div className="flex gap-3 pt-2">
            <Link href="/inbox" className="text-sm text-sovereign-blue font-medium hover:underline">
              Review in Inbox
            </Link>
            <Link href="/dashboard" className="text-sm text-sovereign-blue font-medium hover:underline">
              See dashboard
            </Link>
          </div>
        </section>
      )}

      <div className="mt-10 flex items-center justify-between gap-3">
        {step > 0 ? (
          <button type="button" onClick={back} className="text-sm font-medium text-mono-medium hover:text-mono-dark">
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={next}
          disabled={!canContinue}
          className="btn-primary rounded-2xl disabled:opacity-50"
        >
          {step === 3 ? "Finish" : "Continue"}
        </button>
      </div>

      <p className="mt-8 text-center text-xs text-mono-light">
        <Link href="/dashboard" className="hover:text-mono-medium">
          Skip for now
        </Link>
      </p>
    </div>
  );
}
