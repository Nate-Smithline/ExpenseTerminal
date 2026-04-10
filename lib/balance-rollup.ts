/**
 * Shared balance rollup for dashboard live metrics and daily financial snapshots.
 */

export type DataSourceBalanceInput = {
  id: string;
  name: string;
  account_type: string;
  source_type: string;
  balance_class: string | null;
  include_in_net_worth: boolean | null;
  balance_value_preference: string | null;
  plaid_balance_current: number | string | null;
  plaid_balance_available: number | string | null;
  manual_balance: number | string | null;
};

export type AccountRollupLine = {
  data_source_id: string;
  name: string;
  balance: number | null;
  /** Effective class for display and snapshot JSON */
  balance_class: "asset" | "liability";
  include_in_net_worth: boolean;
};

export type SnapshotAccountJson = {
  data_source_id: string;
  balance: number;
  balance_class: "asset" | "liability";
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function pickDataSourceBalance(r: DataSourceBalanceInput): number | null {
  const pref = (r.balance_value_preference ?? "").trim();
  const manual = r.manual_balance == null ? null : num(r.manual_balance);
  const current = r.plaid_balance_current == null ? null : num(r.plaid_balance_current);
  const available = r.plaid_balance_available == null ? null : num(r.plaid_balance_available);

  if (pref === "manual") return manual;
  if (pref === "available") return available ?? current ?? manual;
  if (pref === "current") return current ?? available ?? manual;

  return manual ?? current ?? available;
}

function effectiveClass(r: DataSourceBalanceInput): "asset" | "liability" {
  const cls = (r.balance_class ?? "").trim();
  if (cls === "liability") return "liability";
  if (cls === "asset") return "asset";
  return r.account_type === "credit" ? "liability" : "asset";
}

export function computeBalanceRollupFromDataSources(
  rows: DataSourceBalanceInput[],
): {
  assets: number;
  liabilities: number;
  netWorth: number;
  accounts: AccountRollupLine[];
  snapshotAccounts: SnapshotAccountJson[];
} {
  let assets = 0;
  let liabilities = 0;
  const accounts: AccountRollupLine[] = [];
  const snapshotAccounts: SnapshotAccountJson[] = [];

  for (const raw of rows) {
    const include = raw.include_in_net_worth !== false;
    const cls = effectiveClass(raw);
    const bal = pickDataSourceBalance(raw);

    accounts.push({
      data_source_id: raw.id,
      name: (raw.name ?? "").trim() || "Account",
      balance: bal,
      balance_class: cls,
      include_in_net_worth: include,
    });

    if (bal != null) {
      snapshotAccounts.push({
        data_source_id: raw.id,
        balance: cls === "liability" ? Math.abs(bal) : bal,
        balance_class: cls,
      });
    }

    if (!include || bal == null) continue;

    if (cls === "liability") {
      liabilities += Math.abs(bal);
    } else {
      assets += bal;
    }
  }

  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    accounts,
    snapshotAccounts,
  };
}
