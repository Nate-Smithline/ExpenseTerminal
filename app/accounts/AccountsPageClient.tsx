"use client";

import { useCallback, useEffect, useState } from "react";
import { usePlaidLink } from "react-plaid-link";
import { IPlus, IInfo, ITrendUp, IClose } from "@/components/ui/icons";

// ─── Types ─────────────────────────────────────────────────────────────────

interface DataSource {
  id: string;
  name: string | null;
  source_type: string;
  account_type: string | null;
  institution_name: string | null;
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
  return acc.institution_name ?? acc.name ?? "Account";
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

export function AccountsPageClient() {
  const [sources, setSources] = useState<DataSource[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editAccountId, setEditAccountId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const editAccount = editAccountId ? sources.find(s => s.id === editAccountId) ?? null : null;
  const deleteAccount = deleteConfirmId ? sources.find(s => s.id === deleteConfirmId) ?? null : null;

  // ── Load accounts ───────────────────────────────────────────────────────

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/data-sources?limit=100", { cache: "no-store" });
      const { data } = await res.json();
      setSources(data ?? []);
    } finally {
      // no-op
    }
  }, []);

  useEffect(() => { load(); }, [load]);

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
    onSuccess: async (public_token, metadata) => {
      setLinking(false);
      setLinkToken(null);
      await fetch("/api/data-sources/plaid/exchange-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_token, metadata }),
      });
      load();
    },
    onExit: () => {
      setLinking(false);
      setLinkToken(null);
    },
  });

  useEffect(() => {
    if (linkToken && ready) openLink();
  }, [linkToken, ready, openLink]);

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
        <div className="acc-note">
          <IInfo size={14} />
          <span>
            Use <strong>Edit</strong> on any account to sync, pause transaction imports, mark a tax savings account, or delete.
            Pausing keeps the <strong>balance &amp; net worth</strong> live without importing transactions into budget &amp; tax.
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
              <div className="acc-modal__row-label">Paused</div>
              <div className="acc-modal__row-hint">
                When on, balance still updates but transactions are not imported
              </div>
            </div>
            <label className="acct__toggle" title="Pause transaction import">
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
          {!account.pull_transactions && " · Paused"}
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
