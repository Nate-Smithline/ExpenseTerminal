"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { IPlus, IInfo, ITrendUp, IClose } from "@/components/ui/icons";

// ─── Types ─────────────────────────────────────────────────────────────────

interface DataSource {
  id: string;
  name: string | null;
  source_type: string;
  account_type: string | null;
  institution_name: string | null;
  institution: string | null;
  mask: string | null;
  balance: number | null;
  balance_updated_at: string | null;
  last_successful_sync_at: string | null;
  is_active: boolean;
  is_mixed_account: boolean;
  is_tax_fund: boolean;
  pull_transactions: boolean;
  created_at: string;
}

interface AccountGroup {
  label: string;
  accounts: DataSource[];
  total: number;
  isLiability: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return Math.abs(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function initials(name: string): string {
  return name
    .split(" ")
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function accountLabel(acc: DataSource): string {
  return acc.institution_name ?? acc.institution ?? acc.name ?? "Account";
}

function groupAccounts(sources: DataSource[]): AccountGroup[] {
  const checking = sources.filter(s => s.account_type === "checking");
  const savings   = sources.filter(s => s.account_type === "savings");
  const credit    = sources.filter(s => s.account_type === "credit");
  const other     = sources.filter(s => !["checking", "savings", "credit"].includes(s.account_type ?? ""));

  const groups: AccountGroup[] = [];
  if (checking.length > 0) groups.push({ label: "Checking", accounts: checking, total: checking.reduce((s, a) => s + (a.balance ?? 0), 0), isLiability: false });
  if (savings.length > 0)  groups.push({ label: "Savings",  accounts: savings,  total: savings.reduce((s, a) => s + (a.balance ?? 0), 0),  isLiability: false });
  if (credit.length > 0)   groups.push({ label: "Credit cards", accounts: credit, total: credit.reduce((s, a) => s + (a.balance ?? 0), 0), isLiability: true });
  if (other.length > 0)    groups.push({ label: "Other",    accounts: other,    total: other.reduce((s, a) => s + (a.balance ?? 0), 0),    isLiability: false });
  return groups;
}

// ─── Main component ─────────────────────────────────────────────────────────

interface PendingLink {
  public_token: string;
  metadata: {
    institution?: { institution_id?: string; name?: string };
    accounts?: Array<{ id?: string; name?: string; type?: string; subtype?: string }>;
  };
}

type LookbackOption =
  | { label: string; kind: "days"; days: number }
  | { label: string; kind: "month_start" }
  | { label: string; kind: "year_start" }
  | { label: string; kind: "all" };

const LOOKBACK_OPTIONS: LookbackOption[] = [
  { label: "This month", kind: "month_start" },
  { label: "This year", kind: "year_start" },
  { label: "Last 30 days", kind: "days", days: 30 },
  { label: "Last 60 days", kind: "days", days: 60 },
  { label: "Last twelve months", kind: "days", days: 365 },
  { label: "All available", kind: "all" },
];

function lookbackStartDate(opt: LookbackOption): string | null {
  if (opt.kind === "all") return null;
  if (opt.kind === "month_start") {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  }
  if (opt.kind === "year_start") {
    return `${new Date().getFullYear()}-01-01`;
  }
  const d = new Date();
  d.setDate(d.getDate() - opt.days);
  return d.toISOString().slice(0, 10);
}

const LOAD_STEPS = [
  "Connecting to your accounts…",
  "Loading account details…",
  "Fetching balances…",
  "Almost ready…",
];

const IMPORT_STEPS = [
  "Securely connecting to your bank…",
  "Verifying account credentials…",
  "Pulling account details…",
  "Fetching current balance…",
  "Setting up transaction history…",
  "Importing transactions…",
  "Organizing your data…",
  "Almost done…",
];

export function AccountsPageClient() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [selectedLookback, setSelectedLookback] = useState(4); // index into LOOKBACK_OPTIONS (Last twelve months)
  const [importing, setImporting] = useState(false);

  // ── Loading bar ─────────────────────────────────────────────────────────
  const [loadPhase, setLoadPhase] = useState<"loading" | "done" | "idle">("loading");
  const [loadStep, setLoadStep] = useState(0);
  const [loadPct, setLoadPct] = useState(8);
  const loadTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Import progress ──────────────────────────────────────────────────────
  const [importStep, setImportStep] = useState(0);
  const [importPct, setImportPct] = useState(6);
  const importTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const editAccount = editAccountId ? sources.find(s => s.id === editAccountId) ?? null : null;
  const deleteAccount = deleteConfirmId ? sources.find(s => s.id === deleteConfirmId) ?? null : null;

  // ── Load accounts ───────────────────────────────────────────────────────

  const load = useCallback(async (showBar = false) => {
    if (showBar) {
      setLoadPhase("loading");
      setLoadStep(0);
      setLoadPct(8);
      if (loadTimer.current) clearInterval(loadTimer.current);
      let step = 0;
      loadTimer.current = setInterval(() => {
        step += 1;
        setLoadStep(Math.min(step, LOAD_STEPS.length - 1));
        setLoadPct(Math.min(8 + step * 22, 88));
      }, 600);
    }
    try {
      const res = await fetch("/api/data-sources?limit=100", { cache: "no-store" });
      const { data } = await res.json();
      setSources(data ?? []);
    } finally {
      if (showBar) {
        if (loadTimer.current) clearInterval(loadTimer.current);
        setLoadPct(100);
        setLoadStep(LOAD_STEPS.length - 1);
        setTimeout(() => setLoadPhase("done"), 500);
        setTimeout(() => setLoadPhase("idle"), 1000);
      }
    }
  }, []);

  useEffect(() => { load(true); }, [load]);

  // ── Plaid link ──────────────────────────────────────────────────────────

  async function openPlaidLink() {
    setLinking(true);
    try {
      const res = await fetch("/api/data-sources/plaid/create-link-token", { method: "POST" });
      const { link_token } = await res.json();
      setLinkToken(link_token);
    } catch {
      setLinking(false);
    }
  }

  const { open: openLink, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (public_token, metadata) => {
      setLinking(false);
      setLinkToken(null);
      // Show date picker modal before completing the import
      setPendingLink({ public_token, metadata: metadata as PendingLink["metadata"] });
    },
    onExit: () => {
      setLinking(false);
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) openLink();
  }, [linkToken, ready, openLink]);

  async function confirmImport() {
    if (!pendingLink) return;
    setImporting(true);
    setImportError(null);
    setImportStep(0);
    setImportPct(6);

    if (importTimer.current) clearInterval(importTimer.current);
    let step = 0;
    importTimer.current = setInterval(() => {
      step += 1;
      const maxStep = IMPORT_STEPS.length - 2;
      setImportStep(Math.min(step, maxStep));
      setImportPct(Math.min(6 + step * 14, 82));
    }, 900);

    const opt = LOOKBACK_OPTIONS[selectedLookback];
    const startDate = opt ? lookbackStartDate(opt) : null;
    try {
      const res = await fetch("/api/data-sources/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          public_token: pendingLink.public_token,
          metadata: pendingLink.metadata,
          start_date: startDate,
        }),
      });

      if (importTimer.current) clearInterval(importTimer.current);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const msg = body?.error ?? `Import failed (${res.status})`;
        console.error("[confirmImport]", msg);
        setImportError(msg);
        setImporting(false);
        return;
      }

      // Kick off transaction sync for each newly created account
      const exchangeBody = await res.json().catch(() => ({}));
      const newIds: string[] = exchangeBody?.dataSourceIds ?? [];

      if (newIds.length > 0) {
        setImportStep(5); // "Importing transactions…"
        setImportPct(72);

        // Sync all accounts in parallel — fire and collect results
        const syncResults = await Promise.allSettled(
          newIds.map(id =>
            fetch("/api/data-sources/plaid/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ dataSourceId: id }),
            })
          )
        );

        // Surface the first sync error if any (non-fatal — accounts are still created)
        for (const r of syncResults) {
          if (r.status === "rejected") {
            console.warn("[confirmImport] sync failed:", r.reason);
          } else if (!r.value.ok) {
            const errBody = await r.value.json().catch(() => ({}));
            console.warn("[confirmImport] sync error:", errBody?.error);
          }
        }
      }

      setImportStep(IMPORT_STEPS.length - 1);
      setImportPct(100);
      await new Promise(r => setTimeout(r, 700));
      await load();
      setPendingLink(null);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      if (importTimer.current) clearInterval(importTimer.current);
      setImporting(false);
    }
  }

  // ── Sync ────────────────────────────────────────────────────────────────

  async function syncAccount(id: string) {
    setSyncing(id);
    try {
      await fetch("/api/data-sources/plaid/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataSourceId: id }),
      });
      await load();
    } finally {
      setSyncing(null);
    }
  }

  async function confirmDeleteAccount() {
    if (!deleteConfirmId) return;
    setDeleteError(null);
    setDeleting(deleteConfirmId);
    try {
      const res = await fetch(`/api/data-sources/${deleteConfirmId}`, { method: "DELETE" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(body?.error ?? "Failed to delete account");
        return;
      }
      const removedId = deleteConfirmId;
      setSources(prev => prev.filter(s => s.id !== removedId));
      setDeleteConfirmId(null);
      setEditAccountId(prev => (prev === removedId ? null : prev));
      window.dispatchEvent(new CustomEvent("inbox-count-changed"));
    } finally {
      setDeleting(null);
    }
  }

  function requestDelete(id: string) {
    setDeleteError(null);
    setDeleteConfirmId(id);
  }

  // ── Toggle fields ────────────────────────────────────────────────────────

  async function toggleField(id: string, field: "pull_transactions" | "is_tax_fund" | "is_mixed_account", value: boolean) {
    setSources(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    await fetch(`/api/data-sources/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
  }

  // ── Derived ─────────────────────────────────────────────────────────────

  const groups = groupAccounts(sources);
  const assets = sources.filter(s => s.account_type !== "credit").reduce((sum, s) => sum + (s.balance ?? 0), 0);
  const liabilities = sources.filter(s => s.account_type === "credit").reduce((sum, s) => sum + Math.abs(s.balance ?? 0), 0);
  const netWorth = assets - liabilities;

  const hasAccounts = sources.length > 0;
  const connected = sources.filter(s => s.source_type === "plaid" || s.is_active).length;

  return (
    <div className="page-anim">
      <header className="pagehead">
        <div>
          <div className="pagehead__eyebrow">
            Accounts · synced via Plaid ·{" "}
            <span style={{ color: connected > 0 ? "var(--forest)" : "var(--ink-4)" }}>
              ● {connected > 0 ? `${connected} connected` : "not connected"}
            </span>
          </div>
          <h1 className="pagehead__title">
            Net worth <em>{hasAccounts ? fmtCurrency(netWorth) : "—"}</em>
          </h1>
          <div className="pagehead__sub">Everything you own, everything you owe, in one place.</div>
        </div>
        <div className="pagehead__right">
          <button
            className="btn btn--primary"
            onClick={openPlaidLink}
            disabled={linking}
          >
            <IPlus size={14} /> {linking ? "Connecting…" : "Add account"}
          </button>
        </div>
      </header>

      <div className="acc">
        {/* Loading bar */}
        {(loadPhase === "loading" || loadPhase === "done") && (
          <div className={`acc-load${loadPhase === "done" ? " acc-load--done" : ""}`}>
            <div className="acc-load__bar-track">
              <div
                className={`acc-load__bar-fill${loadPct < 100 ? " acc-load__bar-fill--shimmer" : ""}`}
                style={{ width: `${loadPct}%` }}
              />
            </div>
            <div className="acc-load__status">
              {loadPct < 100 && <span className="acc-load__dot" />}
              <span className="acc-load__step">{LOAD_STEPS[loadStep]}</span>
            </div>
          </div>
        )}

        <div className="acc-note">
          <IInfo size={14} />
          <span>
            Use <strong>Edit</strong> on any account to sync, manage transaction imports, mark a tax savings account, or delete.
            <strong>Balance only</strong> mode keeps balance &amp; net worth live without importing transactions.
          </span>
        </div>

        <div className="card acc__chart-card">
          <div className="acc__chart-stats">
            <div>
              <div className="uppercase-label">Net worth · today</div>
              <div className="money money--xl" style={{ marginTop: 6 }}>
                {hasAccounts ? fmtCurrency(netWorth) : "—"}
              </div>
              {hasAccounts && (
                <div className="acc__chart-delta">
                  <ITrendUp size={14} />
                  Tracking live
                </div>
              )}
            </div>
            <div className="acc__chart-meta">
              <div>
                <div className="uppercase-label">Assets</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                  {hasAccounts ? fmtCurrency(assets) : "—"}
                </div>
              </div>
              <div>
                <div className="uppercase-label">Liabilities</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2, color: "var(--ink-3)" }}>
                  {hasAccounts ? fmtCurrency(liabilities) : "—"}
                </div>
              </div>
              <div>
                <div className="uppercase-label">Accounts</div>
                <div style={{ fontSize: 18, fontWeight: 600, marginTop: 2 }}>
                  {sources.length}
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              height: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderTop: "1px solid var(--border-soft)",
              color: "var(--ink-4)",
              fontSize: 13.5,
            }}
          >
            {hasAccounts
              ? "Net worth chart — wire to snapshots table"
              : "Connect a bank account to start tracking net worth"}
          </div>
        </div>

        {!hasAccounts ? (
          <div className="card" style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏦</div>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              Connect your first account
            </div>
            <div style={{ fontSize: 14, color: "var(--ink-3)", marginBottom: 24, maxWidth: 360, margin: "0 auto 24px" }}>
              Link your bank, credit cards, and investment accounts via Plaid.
              Balances sync automatically every night.
            </div>
            <button className="btn btn--primary" onClick={openPlaidLink} disabled={linking}>
              <IPlus size={14} /> {linking ? "Connecting…" : "Add account"}
            </button>
          </div>
        ) : (
          <div className="acc__list">
            {groups.map(group => (
              <div key={group.label} className="acc__group">
                <div className="acc__group-head">
                  <div>
                    <h3 className="acc__group-title">{group.label}</h3>
                    <div className="acc__group-sub">
                      {group.accounts.length} account{group.accounts.length !== 1 ? "s" : ""}
                      {" · "}
                      <span style={{ fontWeight: 600 }}>
                        {group.isLiability ? "−" : "+"}{fmtCurrency(Math.abs(group.total))}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="acc__cards">
                  {group.accounts.map(acc => (
                    <AccountCard
                      key={acc.id}
                      account={acc}
                      onEdit={() => setEditAccountId(acc.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit account modal */}
      {editAccount && !deleteConfirmId && (
        <AccountEditModal
          account={editAccount}
          syncing={syncing === editAccount.id}
          onClose={() => setEditAccountId(null)}
          onSync={() => syncAccount(editAccount.id)}
          onRequestDelete={() => requestDelete(editAccount.id)}
          onToggle={toggleField}
        />
      )}

      {/* Import date picker modal */}
      {pendingLink && !importing && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="acc-import-title"
        >
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <div className="acc-modal__head">
              <div>
                <h2 id="acc-import-title" className="acc-modal__title">How far back should we pull?</h2>
                <p className="acc-modal__sub">
                  {pendingLink.metadata?.institution?.name ?? "Your bank"} — choose the transaction history to import
                </p>
              </div>
            </div>
            <div className="acc-modal__body" style={{ gap: 8 }}>
              {LOOKBACK_OPTIONS.map((opt, i) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => setSelectedLookback(i)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "10px 14px",
                    border: selectedLookback === i ? "2px solid var(--forest)" : "1px solid var(--border-soft)",
                    borderRadius: "var(--r-2)",
                    background: selectedLookback === i ? "var(--forest-tint)" : "var(--bone)",
                    cursor: "pointer",
                    fontWeight: selectedLookback === i ? 600 : 400,
                    color: selectedLookback === i ? "var(--forest-deep)" : "var(--ink)",
                    fontSize: 14,
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: selectedLookback === i ? "5px solid var(--forest)" : "2px solid var(--ink-4)",
                    flexShrink: 0,
                  }} />
                  {opt.label}
                  {opt.kind === "days" && opt.days === 365 && (
                    <span style={{ marginLeft: "auto", fontSize: 11.5, fontWeight: 500, color: "var(--forest)", background: "var(--forest-tint)", padding: "2px 7px", borderRadius: 999 }}>
                      Recommended
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="acc-modal__actions" style={{ flexDirection: "row", justifyContent: "flex-end", paddingTop: 16 }}>
              <button
                type="button"
                className="btn btn--ghost"
                onClick={() => setPendingLink(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                onClick={confirmImport}
              >
                Import transactions
              </button>
            </div>
          </div>
        </div>
      )}

      {(importing || importError) && (
        <div className="acc-modal-backdrop" role="dialog" aria-modal="true">
          <div className="acc-modal" style={{ padding: 0 }}>
            {importError ? (
              <div className="acc-import-progress">
                <div className="acc-import-progress__icon" style={{ background: "var(--ember-tint)", color: "var(--ember)" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="acc-import-progress__title">Import failed</div>
                <div className="acc-import-progress__status" style={{ color: "var(--ember-deep)" }}>
                  {importError}
                </div>
                <button
                  type="button"
                  className="btn btn--ghost"
                  style={{ marginTop: 4 }}
                  onClick={() => { setImportError(null); setPendingLink(null); }}
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <div className="acc-import-progress">
                <div className="acc-import-progress__icon">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                </div>
                <div className="acc-import-progress__title">Importing account</div>
                <div className="acc-import-progress__track">
                  <div
                    className="acc-import-progress__fill"
                    style={{ width: `${importPct}%` }}
                  />
                </div>
                <div key={importStep} className="acc-import-progress__status">
                  {IMPORT_STEPS[importStep]}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteAccount && (
        <div
          className="acc-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="acc-delete-title"
          onClick={() => !deleting && setDeleteConfirmId(null)}
        >
          <div className="acc-modal" onClick={e => e.stopPropagation()}>
            <div className="acc-modal__head" style={{ borderBottom: "none", paddingBottom: 0 }}>
              <div>
                <h2 id="acc-delete-title" className="acc-modal__title">
                  Delete account?
                </h2>
                <p className="acc-modal__sub" style={{ fontFamily: "inherit" }}>
                  {accountLabel(deleteAccount)}
                  {deleteAccount.mask ? ` · ····${deleteAccount.mask}` : ""}
                </p>
              </div>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--ink-3)", margin: "8px 20px 0" }}>
              This will remove the account and permanently delete all imported transactions. This cannot be undone.
            </p>
            {deleteError && (
              <p className="acc-modal__error">{deleteError}</p>
            )}
            <div className="acc-modal__actions" style={{ flexDirection: "row", justifyContent: "flex-end", paddingTop: 16 }}>
              <button
                type="button"
                className="btn btn--ghost"
                disabled={!!deleting}
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteError(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={!!deleting}
                onClick={confirmDeleteAccount}
                style={{ background: "var(--ember)", borderColor: "var(--ember)" }}
              >
                {deleting ? "Deleting…" : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Account edit modal ──────────────────────────────────────────────────────

function AccountEditModal({
  account,
  syncing,
  onClose,
  onSync,
  onRequestDelete,
  onToggle,
}: {
  account: DataSource;
  syncing: boolean;
  onClose: () => void;
  onSync: () => void;
  onRequestDelete: () => void;
  onToggle: (id: string, field: "pull_transactions" | "is_tax_fund" | "is_mixed_account", value: boolean) => void;
}) {
  const displayName = accountLabel(account);
  const isPlaid = account.source_type === "plaid";
  const lastSync = account.last_successful_sync_at
    ? new Date(account.last_successful_sync_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div
      className="acc-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="acc-edit-title"
      onClick={onClose}
    >
      <div className="acc-modal" onClick={e => e.stopPropagation()}>
        <div className="acc-modal__head">
          <div style={{ minWidth: 0 }}>
            <h2 id="acc-edit-title" className="acc-modal__title">
              {account.name ?? account.account_type ?? "Account"}
            </h2>
            <p className="acc-modal__sub">
              {displayName}
              {account.mask ? ` · ····${account.mask}` : ""}
            </p>
          </div>
          <button type="button" className="acc-modal__close" onClick={onClose} aria-label="Close">
            <IClose size={16} />
          </button>
        </div>

        <div className="acc-modal__body">
          <div className="acc-modal__row">
            <div>
              <div className="acc-modal__row-label">Balance only</div>
              <div className="acc-modal__row-hint">
                When on, balance still syncs but no transactions are imported
              </div>
            </div>
            <label className="acct__toggle" title="Balance only mode">
              <input
                type="checkbox"
                checked={!account.pull_transactions}
                onChange={e => onToggle(account.id, "pull_transactions", !e.target.checked)}
              />
              <span />
            </label>
          </div>

          <div className="acc-modal__row">
            <div>
              <div className="acc-modal__row-label">Tax savings account</div>
              <div className="acc-modal__row-hint">
                Mark funds set aside for estimated taxes
              </div>
            </div>
            <label className="acct__toggle">
              <input
                type="checkbox"
                checked={account.is_tax_fund}
                onChange={e => onToggle(account.id, "is_tax_fund", e.target.checked)}
              />
              <span />
            </label>
          </div>
        </div>

        <div className="acc-modal__actions">
          {isPlaid && (
            <button
              type="button"
              className="btn btn--ghost acc-modal__sync"
              onClick={onSync}
              disabled={syncing}
            >
              {syncing ? "Syncing…" : "Sync now"}
              {lastSync && !syncing && (
                <span style={{ marginLeft: 8, fontWeight: 500, color: "var(--ink-3)" }}>
                  · last {lastSync}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost acc-modal__delete"
            onClick={onRequestDelete}
          >
            Delete account
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AccountCard ─────────────────────────────────────────────────────────────

function AccountCard({
  account,
  onEdit,
}: {
  account: DataSource;
  onEdit: () => void;
}) {
  const displayName = accountLabel(account);
  const balance = account.balance ?? 0;
  const isPlaid = account.source_type === "plaid";
  const lastSync = account.last_successful_sync_at
    ? new Date(account.last_successful_sync_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;

  return (
    <div className="acct">
      <div className="acct__head">
        <div className="acct__inst">
          <div className="acct__inst-mark">{initials(displayName)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="acct__inst-name">{displayName}</div>
            {account.mask && (
              <div className="acct__inst-mask">····{account.mask}</div>
            )}
          </div>
        </div>
        <button type="button" className="acct__edit" onClick={onEdit}>
          Edit
        </button>
      </div>

      <div className="acct__name">
        {account.name ?? account.account_type ?? "Account"}
      </div>

      <div className="acct__balance">
        {balance < 0 ? "−" : ""}{fmtCurrency(Math.abs(balance))}
      </div>

      <div className="acct__foot">
        <span>
          {isPlaid && lastSync ? `Synced ${lastSync}` : "Manual"}
          {!account.pull_transactions && " · Balance only"}
        </span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {account.is_tax_fund && (
            <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--forest)", background: "var(--forest-tint)", padding: "2px 7px", borderRadius: 999 }}>
              Tax fund
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
