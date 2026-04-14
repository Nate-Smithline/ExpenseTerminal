import { categorizeTransactionsForUser } from "@/lib/ai/categorize-transactions";
import {
  evaluateOrgRuleConditions,
  ruleDeterministicActions,
  ruleHasAiAction,
} from "./evaluate";
import type { OrgRuleTransactionRow } from "./filter-match";
import { mergeCustomFieldsPatch, type PropertyDefinitionRow } from "@/lib/custom-field-validation";
import type { OrgRuleAction, OrgRuleConditions } from "./schemas";
import {
  orgRuleAllowsFullBackfill,
  orgRuleRunsOnDaily,
  orgRuleRunsOnIngest,
  parseOrgRuleActions,
  parseOrgRuleConditions,
} from "./schemas";
import {
  coerceOrgRuleStandardFieldPatch,
  type OrgRuleStandardWritableField,
} from "./standard-field-actions";

const TX_RULE_SELECT =
  "id,user_id,date,vendor,description,amount,transaction_type,status,category,schedule_c_line,source,ai_confidence,business_purpose,quick_label,notes,deduction_percent,vendor_normalized,data_source_id,created_at,custom_fields" as const;

/**
 * All data_source IDs that belong to an org — the proper scope for org-wide
 * transaction queries (NOT user_id membership, which leaks cross-org data).
 */
async function fetchOrgDataSourceIds(supabase: any, orgId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("data_sources")
    .select("id")
    .eq("org_id", orgId);
  if (error) {
    console.warn("[org-rules] fetchOrgDataSourceIds", error.message);
    return [];
  }
  return (data ?? []).map((r: { id: string }) => r.id).filter(Boolean);
}

type TxRuleWork = OrgRuleTransactionRow & { id: string; user_id: string };

export type OrgTransactionRuleRow = {
  id: string;
  org_id: string;
  name: string;
  enabled: boolean;
  position: number;
  conditions_json: unknown;
  actions_json: unknown;
  trigger_mode: string;
  once_completed_at: string | null;
  created_at?: string;
};

type PropertyDef = {
  id: string;
  type: string;
  config: unknown;
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function sortRules(rows: OrgTransactionRuleRow[]): OrgTransactionRuleRow[] {
  return [...rows].sort(
    (a, b) =>
      a.position - b.position ||
      (a.created_at ?? "").localeCompare(b.created_at ?? "") ||
      a.id.localeCompare(b.id),
  );
}

async function loadPropertyDefinitions(supabase: any, orgId: string): Promise<Map<string, PropertyDef>> {
  const { data } = await supabase
    .from("transaction_property_definitions")
    .select("id,type,config")
    .eq("org_id", orgId);
  const map = new Map<string, PropertyDef>();
  for (const row of data ?? []) {
    if (row?.id) map.set(row.id, row as PropertyDef);
  }
  return map;
}

async function fetchTransactionsByIds(
  supabase: any,
  ids: string[],
  orgDataSourceIds: string[],
): Promise<TxRuleWork[]> {
  if (ids.length === 0 || orgDataSourceIds.length === 0) return [];
  const chunk = 100;
  const out: TxRuleWork[] = [];
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const { data, error } = await supabase
      .from("transactions")
      .select(TX_RULE_SELECT)
      .in("id", slice)
      .in("data_source_id", orgDataSourceIds);
    if (error) {
      console.warn("[org-rules] fetchTransactionsByIds", error.message);
      continue;
    }
    out.push(...((data ?? []) as TxRuleWork[]));
  }
  return out;
}

/**
 * Core engine: AI-first globally, then deterministic actions in rule order.
 */
export async function runOrgTransactionRulesEngine(opts: {
  supabase: any;
  orgId: string;
  rules: OrgTransactionRuleRow[];
  orgDataSourceIds: string[];
  transactions: TxRuleWork[];
  /** Per-user industry hint for AI */
  businessIndustryByUserId?: Map<string, string | null>;
}): Promise<{ matchCount: number; updateCount: number; aiCount: number; errors: string[]; _debug?: Record<string, unknown> }> {
  const { supabase, orgId, rules, orgDataSourceIds, transactions } = opts;
  const errors: string[] = [];
  if (transactions.length === 0 || rules.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors };
  }

  const sortedRules = sortRules(rules);
  const parsedRules: {
    row: OrgTransactionRuleRow;
    conditions: OrgRuleConditions;
    actions: OrgRuleAction[];
  }[] = [];

  for (const row of sortedRules) {
    const conditions = parseOrgRuleConditions(row.conditions_json);
    const actions = parseOrgRuleActions(row.actions_json);
    if (!conditions || !actions) {
      errors.push(`Rule ${row.id}: invalid conditions or actions JSON`);
      continue;
    }
    parsedRules.push({ row, conditions, actions });
  }

  if (parsedRules.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors };
  }

  const propertyDefs = await loadPropertyDefinitions(supabase, orgId);
  const orgTypes = new Map<string, string>();
  for (const def of propertyDefs.values()) {
    orgTypes.set(def.id, def.type);
  }

  console.log(`[org-rules] Engine start: ${transactions.length} txs, ${parsedRules.length} rules, ${propertyDefs.size} property defs`);
  for (const pr of parsedRules) {
    const dActions = ruleDeterministicActions(pr.actions);
    console.log(`[org-rules]   Rule ${pr.row.id} "${pr.row.name}": ${pr.conditions.conditions.length} conditions, ${pr.actions.length} actions (${dActions.length} deterministic)`);
    for (const a of dActions) {
      if (a.type === "set_custom_property") {
        const def = propertyDefs.get(a.propertyDefinitionId);
        console.log(`[org-rules]     → set_custom_property propDef=${a.propertyDefinitionId} value=${JSON.stringify(a.value)} defFound=${!!def} defType=${def?.type ?? "N/A"}`);
      } else if (a.type === "set_standard_field") {
        console.log(`[org-rules]     → set_standard_field field=${a.field} value=${JSON.stringify(a.value)}`);
      }
    }
  }

  const aiNeeded = new Set<string>();
  let matchCount = 0;

  for (const tx of transactions) {
    for (const pr of parsedRules) {
      if (!evaluateOrgRuleConditions(tx, pr.conditions, orgTypes)) continue;
      matchCount++;
      if (ruleHasAiAction(pr.actions)) {
        aiNeeded.add(tx.id);
      }
    }
  }

  console.log(`[org-rules] First pass: ${matchCount} matches, ${aiNeeded.size} need AI`);

  let aiCount = 0;
  if (aiNeeded.size > 0) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey || !apiKey.startsWith("sk-ant-")) {
      errors.push("ANTHROPIC_API_KEY missing; skipped AI rule actions");
    } else {
      const byUser = new Map<string, string[]>();
      for (const tx of transactions) {
        if (!aiNeeded.has(tx.id)) continue;
        const list = byUser.get(tx.user_id) ?? [];
        list.push(tx.id);
        byUser.set(tx.user_id, list);
      }
      for (const [userId, ids] of byUser) {
        let industry: string | null | undefined = opts.businessIndustryByUserId?.get(userId);
        if (industry === undefined) {
          const { data: orgRow } = await supabase
            .from("org_settings")
            .select("business_industry")
            .eq("user_id", userId)
            .maybeSingle();
          industry = orgRow?.business_industry ?? null;
        }
        await categorizeTransactionsForUser({
          supabase,
          userId,
          transactionIds: ids,
          businessIndustry: industry ?? null,
          onEvent: () => {},
        });
        // Stub `categorizeTransactionsForUser` returns void; real impl would report via onEvent.
      }
    }
  }

  // Use the original batch directly — avoids a large `.in("id", …)` reload that
  // can exceed PostgREST URL-length limits when the batch is >~300 rows.
  // AI-categorised transactions already had their changes written by the AI step above;
  // the deterministic pass only needs the original field values (vendor, amount, etc.).
  const byId = new Map(transactions.map((t) => [t.id, t]));
  const txIds = Array.from(byId.keys());

  let updateCount = 0;
  let secondPassMatchCount = 0;
  let skippedNotInReload = 0;

  for (const txId of txIds) {
    const tx = byId.get(txId);
    if (!tx) {
      skippedNotInReload++;
      continue;
    }

    const update: Record<string, unknown> = {};
    let customFields: Record<string, unknown> | null = null;

    let secondPassMatched = false;
    for (const pr of parsedRules) {
      if (!evaluateOrgRuleConditions(tx, pr.conditions, orgTypes)) continue;
      secondPassMatched = true;
      const dActions = ruleDeterministicActions(pr.actions);
      if (dActions.length === 0) {
        console.warn(`[org-rules] Rule "${pr.row.name}" matched tx ${tx.id} but has 0 deterministic actions (all actions: ${JSON.stringify(pr.actions.map((a) => a.type))})`);
      }
      for (const action of dActions) {
        console.log(`[org-rules] Processing action type="${action.type}" for tx ${tx.id.slice(0, 8)}…`);

        if (action.type === "set_standard_field") {
          const r = coerceOrgRuleStandardFieldPatch(action.field as OrgRuleStandardWritableField, action.value);
          if (!r.ok) {
            errors.push(`Rule ${pr.row.id}: ${r.error}`);
            continue;
          }
          Object.assign(update, r.patch);
          if (
            action.field === "category" &&
            tx.status === "pending" &&
            update.status === undefined &&
            r.patch.category != null &&
            String(r.patch.category).trim() !== ""
          ) {
            update.status = "auto_sorted";
          }
        } else if (action.type === "set_custom_property") {
          const def = propertyDefs.get(action.propertyDefinitionId);
          if (!def) {
            errors.push(`Rule ${pr.row.id}: unknown property ${action.propertyDefinitionId}`);
            continue;
          }
          const row: PropertyDefinitionRow = {
            id: def.id,
            type: def.type,
            config: def.config && typeof def.config === "object" ? (def.config as Record<string, unknown>) : null,
          };
          const map = new Map<string, PropertyDefinitionRow>([[def.id, row]]);
          if (customFields === null) {
            customFields = { ...asRecord(tx.custom_fields) };
          }
          const merged = mergeCustomFieldsPatch(
            customFields,
            { [action.propertyDefinitionId]: action.value },
            map,
          );
          if (!merged.ok) {
            errors.push(`Rule ${pr.row.id}: ${merged.error}`);
            continue;
          }
          customFields = merged.merged;
        }
      }
    }

    if (customFields !== null) {
      update.custom_fields = customFields;
    }

    if (secondPassMatched) {
      secondPassMatchCount++;
    }

    const updateKeys = Object.keys(update);
    if (updateKeys.length > 0) {
      console.log(`[org-rules] Updating tx ${tx.id}: keys=${JSON.stringify(updateKeys)} custom_fields=${customFields != null ? JSON.stringify(customFields) : "null"}`);
      update.updated_at = new Date().toISOString();
      const { data: updatedRows, error: updateErr } = await supabase
        .from("transactions")
        .update(update)
        .eq("id", tx.id)
        .eq("user_id", tx.user_id)
        .select("id,custom_fields");
      if (updateErr) {
        console.error(`[org-rules] Update FAILED tx ${tx.id}: ${updateErr.message}`);
        errors.push(`Update ${tx.id}: ${updateErr.message}`);
      } else if (!updatedRows || updatedRows.length === 0) {
        console.error(`[org-rules] Update 0 ROWS tx ${tx.id} user_id=${tx.user_id}`);
        errors.push(`Update ${tx.id}: 0 rows affected (id/user_id mismatch?)`);
      } else {
        console.log(`[org-rules] Update OK tx ${tx.id}: custom_fields=${JSON.stringify(updatedRows[0]?.custom_fields)}`);
        updateCount++;
      }
    } else {
      console.log(`[org-rules] Tx ${tx.id} matched but no update keys (conditions matched but all actions produced no changes)`);
    }
  }

  const totalDeterministicActions = parsedRules.reduce(
    (sum, pr) => sum + ruleDeterministicActions(pr.actions).length,
    0,
  );
  if (matchCount > 0 && updateCount === 0 && errors.length === 0) {
    if (totalDeterministicActions === 0) {
      errors.push("Rule has no field/property actions — only AI categorize. Add a 'Set property' or 'Set field' action.");
    } else {
      errors.push(
        `1st-pass: ${matchCount} matched | 2nd-pass: ${secondPassMatchCount} matched, ${skippedNotInReload} missing | actions: ${totalDeterministicActions} deterministic, types: ${JSON.stringify(parsedRules.flatMap((pr) => pr.actions.map((a) => a.type)))}`,
      );
    }
  }

  console.log(`[org-rules] Engine done: 1st=${matchCount} 2nd=${secondPassMatchCount} updated=${updateCount} errors=${errors.length} deterministicActions=${totalDeterministicActions}`);

  const _debug = {
    transactionCount: transactions.length,
    parsedRuleCount: parsedRules.length,
    propertyDefCount: propertyDefs.size,
    propertyDefs: [...propertyDefs.entries()].map(([id, d]) => ({
      id,
      type: d.type,
      configKeys: d.config && typeof d.config === "object" ? Object.keys(d.config as Record<string, unknown>) : [],
    })),
    rules: parsedRules.map((pr) => ({
      id: pr.row.id,
      name: pr.row.name,
      conditions: pr.conditions,
      actions: pr.actions,
    })),
    sampleTx: transactions.length > 0
      ? {
          id: transactions[0].id,
          vendor: transactions[0].vendor,
          description: transactions[0].description,
          custom_fields: transactions[0].custom_fields,
          data_source_id: transactions[0].data_source_id,
        }
      : null,
  };

  return { matchCount, updateCount, aiCount, errors, _debug };
}

async function loadEnabledRulesForOrg(
  supabase: any,
  orgId: string,
  filter: "ingest" | "daily" | "all_enabled",
): Promise<OrgTransactionRuleRow[]> {
  const { data, error } = await supabase
    .from("org_transaction_rules")
    .select("id,org_id,name,enabled,position,conditions_json,actions_json,trigger_mode,once_completed_at,created_at")
    .eq("org_id", orgId)
    .eq("enabled", true);
  if (error) {
    console.warn("[org-rules] loadEnabledRulesForOrg", error.message);
    return [];
  }
  let rows = (data ?? []) as OrgTransactionRuleRow[];
  if (filter === "ingest") {
    rows = rows.filter((r) => orgRuleRunsOnIngest(r.trigger_mode));
  } else if (filter === "daily") {
    rows = rows.filter((r) => orgRuleRunsOnDaily(r.trigger_mode));
  }
  return rows;
}

/**
 * After Plaid/CSV ingest: run org rules that apply to new transactions.
 */
export async function runOrgRulesForIngest(
  supabase: any,
  orgId: string,
  transactionIds: string[],
): Promise<{ matchCount: number; updateCount: number; aiCount: number; errors: string[] }> {
  if (transactionIds.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: [] };
  }
  const orgDataSourceIds = await fetchOrgDataSourceIds(supabase, orgId);
  if (orgDataSourceIds.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: [] };
  }
  const txs = await fetchTransactionsByIds(supabase, transactionIds, orgDataSourceIds);
  if (txs.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: [] };
  }
  const rules = await loadEnabledRulesForOrg(supabase, orgId, "ingest");
  return runOrgTransactionRulesEngine({ supabase, orgId, rules, orgDataSourceIds, transactions: txs });
}

const DAILY_LOOKBACK_DAYS = 14;
const DAILY_MAX_ROWS = 4000;

/**
 * Daily cron: rules that apply to existing transactions on recently updated rows for one org.
 */
export async function runOrgRulesDailyForOrg(supabase: any, orgId: string): Promise<{
  matchCount: number;
  updateCount: number;
  aiCount: number;
  errors: string[];
  transactionSample: number;
}> {
  const orgDataSourceIds = await fetchOrgDataSourceIds(supabase, orgId);
  if (orgDataSourceIds.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: [], transactionSample: 0 };
  }
  const rules = await loadEnabledRulesForOrg(supabase, orgId, "daily");
  if (rules.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: [], transactionSample: 0 };
  }

  const since = new Date(Date.now() - DAILY_LOOKBACK_DAYS * 86400000).toISOString();
  const { data, error } = await supabase
    .from("transactions")
    .select(TX_RULE_SELECT)
    .in("data_source_id", orgDataSourceIds)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(DAILY_MAX_ROWS);

  if (error) {
    return {
      matchCount: 0,
      updateCount: 0,
      aiCount: 0,
      errors: [error.message],
      transactionSample: 0,
    };
  }

  const transactions = (data ?? []) as TxRuleWork[];
  const res = await runOrgTransactionRulesEngine({
    supabase,
    orgId,
    rules,
    orgDataSourceIds,
    transactions,
  });
  return { ...res, transactionSample: transactions.length };
}

export type OrgRulesDailyOrgResult = {
  orgId: string;
  matchCount: number;
  updateCount: number;
  aiCount: number;
  errors: string[];
  transactionSample: number;
};

/**
 * Run daily org rules for every org that has at least one enabled rule that applies to existing data.
 */
export async function runOrgRulesDailyAllOrgs(supabase: any): Promise<OrgRulesDailyOrgResult[]> {
  const { data: orgRows } = await supabase
    .from("org_transaction_rules")
    .select("org_id,trigger_mode")
    .eq("enabled", true)
    .in("trigger_mode", ["new_and_existing", "existing_only"]);

  const rawOrgIds: string[] = [];
  for (const r of orgRows ?? []) {
    const id = (r as { org_id?: unknown }).org_id;
    if (typeof id === "string" && id.length > 0) rawOrgIds.push(id);
  }
  const orgIds: string[] = [...new Set(rawOrgIds)];
  const merged: OrgRulesDailyOrgResult[] = [];

  for (const orgId of orgIds) {
    const r = await runOrgRulesDailyForOrg(supabase, orgId);
    merged.push({ orgId, ...r });
  }

  return merged;
}

const ONCE_BACKFILL_PAGE = 800;

/**
 * Run a single rule against all org-member transactions (manual full backfill).
 */
export async function runOrgRulesOnceBackfill(
  supabase: any,
  orgId: string,
  ruleId: string,
): Promise<{ matchCount: number; updateCount: number; aiCount: number; errors: string[]; scanned: number; _debug?: Record<string, unknown> | null }> {
  const { data: ruleRow, error: ruleErr } = await supabase
    .from("org_transaction_rules")
    .select("id,org_id,name,enabled,position,conditions_json,actions_json,trigger_mode,once_completed_at,created_at")
    .eq("id", ruleId)
    .eq("org_id", orgId)
    .maybeSingle();

  if (ruleErr || !ruleRow) {
    return {
      matchCount: 0,
      updateCount: 0,
      aiCount: 0,
      errors: [ruleErr?.message ?? "Rule not found"],
      scanned: 0,
    };
  }

  const row = ruleRow as OrgTransactionRuleRow;
  if (!orgRuleAllowsFullBackfill(row.trigger_mode)) {
    return {
      matchCount: 0,
      updateCount: 0,
      aiCount: 0,
      errors: ["This rule only applies to new transactions; full backfill is not available."],
      scanned: 0,
    };
  }
  if (!row.enabled) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: ["Rule is disabled"], scanned: 0 };
  }

  const orgDataSourceIds = await fetchOrgDataSourceIds(supabase, orgId);
  if (orgDataSourceIds.length === 0) {
    return { matchCount: 0, updateCount: 0, aiCount: 0, errors: ["No accounts linked to this org"], scanned: 0 };
  }

  let offset = 0;
  let totalMatch = 0;
  let totalUpdate = 0;
  let totalAi = 0;
  const allErrors: string[] = [];
  let scanned = 0;
  let firstDebug: Record<string, unknown> | null = null;

  console.log(`[org-rules] Backfill rule=${ruleId} org=${orgId} dataSources=${orgDataSourceIds.length}`);
  console.log(`[org-rules] Rule raw actions_json: ${JSON.stringify(row.actions_json)}`);
  console.log(`[org-rules] Rule raw conditions_json: ${JSON.stringify(row.conditions_json)}`);

  for (;;) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TX_RULE_SELECT)
      .in("data_source_id", orgDataSourceIds)
      .order("date", { ascending: false })
      .range(offset, offset + ONCE_BACKFILL_PAGE - 1);

    if (error) {
      allErrors.push(error.message);
      break;
    }
    const batch = (data ?? []) as TxRuleWork[];
    scanned += batch.length;
    if (batch.length === 0) break;

    const res = await runOrgTransactionRulesEngine({
      supabase,
      orgId,
      rules: [row],
      orgDataSourceIds,
      transactions: batch,
    });
    totalMatch += res.matchCount;
    totalUpdate += res.updateCount;
    totalAi += res.aiCount;
    allErrors.push(...res.errors);
    if (!firstDebug && (res as any)._debug) {
      firstDebug = (res as any)._debug;
    }

    if (batch.length < ONCE_BACKFILL_PAGE) break;
    offset += ONCE_BACKFILL_PAGE;
  }

  return {
    matchCount: totalMatch,
    updateCount: totalUpdate,
    aiCount: totalAi,
    errors: allErrors,
    scanned,
    _debug: firstDebug,
  };
}

/**
 * Manual run: enabled rules that apply on ingest for specific transaction IDs (API).
 */
export async function runOrgRulesForTransactionIds(
  supabase: any,
  orgId: string,
  transactionIds: string[],
): Promise<{ matchCount: number; updateCount: number; aiCount: number; errors: string[] }> {
  return runOrgRulesForIngest(supabase, orgId, transactionIds);
}

