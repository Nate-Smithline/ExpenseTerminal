"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import type { Database, Json } from "@/lib/types/database";
import Link from "next/link";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import {
  defaultOpForKind,
  isStandardFilterableColumn,
  opLabel,
  opNeedsSecondValue,
  opNeedsValue,
  opsForKind,
  orgPropertyFilterKind,
  standardColumnFilterKind,
  type ColumnFilterKind,
} from "@/lib/activity-column-filters";
import {
  ACTIVITY_STANDARD_COLUMN_LABELS,
  FILTER_SOURCE_OPTIONS,
  FILTER_STATUS_OPTIONS,
  FILTER_TRANSACTION_TYPE_OPTIONS,
} from "@/lib/activity-filter-constants";
import { ACTIVITY_FILTERABLE_STANDARD_COLUMNS } from "@/lib/validation/schemas";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import {
  orgRuleAllowsFullBackfill,
  parseOrgRuleActions,
  parseOrgRuleConditions,
  type OrgRuleAction,
  type OrgRuleConditions,
  type OrgRuleFilterCondition,
  type OrgRuleTriggerMode,
} from "@/lib/org-rules/schemas";
import {
  ORG_RULE_STANDARD_FIELD_LABELS,
  ORG_RULE_STANDARD_WRITABLE_FIELDS,
  type OrgRuleStandardWritableField,
} from "@/lib/org-rules/standard-field-actions";

type OrgRuleRow = Database["public"]["Tables"]["org_transaction_rules"]["Row"];
type PropDefRow = Database["public"]["Tables"]["transaction_property_definitions"]["Row"];

type DataSourceOpt = { id: string; name: string };

const APPLY_TO_OPTIONS: { value: OrgRuleTriggerMode; label: string }[] = [
  { value: "new_and_existing", label: "New & existing transactions" },
  { value: "new_only", label: "New transactions only" },
  { value: "existing_only", label: "Existing transactions only" },
];

const APPLY_TO_SHORT_LABEL: Record<OrgRuleTriggerMode, string> = {
  new_and_existing: "New & existing",
  new_only: "New only",
  existing_only: "Existing only",
};

/** Normalize legacy DB values before migration or cached responses. */
function normalizeRuleApplyTo(mode: string): OrgRuleTriggerMode {
  if (mode === "new_and_existing" || mode === "new_only" || mode === "existing_only") return mode;
  if (mode === "continuous") return "new_and_existing";
  if (mode === "once") return "existing_only";
  return "new_and_existing";
}

function newConditionId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `c-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toPropDefs(rows: PropDefRow[]): TransactionPropertyDefinition[] {
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    config: (p.config && typeof p.config === "object" ? (p.config as Record<string, unknown>) : null) as Record<
      string,
      unknown
    > | null,
    position: p.position,
  }));
}

function kindForRulesColumn(column: string, defs: TransactionPropertyDefinition[]): ColumnFilterKind {
  if (isStandardFilterableColumn(column)) return standardColumnFilterKind(column);
  const d = defs.find((p) => p.id === column);
  return orgPropertyFilterKind(d?.type ?? "short_text");
}

function columnLabel(column: string, defs: TransactionPropertyDefinition[]): string {
  if (isStandardFilterableColumn(column)) return ACTIVITY_STANDARD_COLUMN_LABELS[column];
  return defs.find((p) => p.id === column)?.name ?? "Property";
}

function selectOptionsFromDef(def?: TransactionPropertyDefinition): { id: string; label: string }[] {
  const c = def?.config && typeof def.config === "object" ? (def.config as { options?: unknown }).options : null;
  if (!Array.isArray(c)) return [];
  return c
    .map((o) =>
      o && typeof o === "object" && typeof (o as { id?: unknown }).id === "string"
        ? { id: (o as { id: string }).id, label: String((o as { label?: unknown }).label ?? (o as { id: string }).id) }
        : null,
    )
    .filter(Boolean) as { id: string; label: string }[];
}

function defaultStandardRuleValue(field: OrgRuleStandardWritableField): unknown {
  switch (field) {
    case "deduction_percent":
      return 100;
    case "amount":
      return 0;
    case "status":
      return "auto_sorted";
    case "transaction_type":
      return "expense";
    case "source":
      return "manual";
    case "date":
      return new Date().toISOString().slice(0, 10);
    case "vendor":
      return "Unknown vendor";
    default:
      return "";
  }
}

function defaultCustomRuleValue(def: TransactionPropertyDefinition): unknown {
  switch (def.type) {
    case "checkbox":
      return false;
    case "number":
      return 0;
    case "multi_select":
      return [];
    case "select": {
      const opts = selectOptionsFromDef(def);
      return opts[0]?.id ?? "";
    }
    default:
      return "";
  }
}

function previewUnknownValue(v: unknown): string {
  if (v === null || v === undefined) return "clear";
  if (typeof v === "boolean") return v ? "on" : "off";
  if (Array.isArray(v)) return v.length ? `${v.length} selected` : "none";
  const s = String(v);
  return s.length > 28 ? `${s.slice(0, 28)}…` : s;
}

function summarizeConditions(
  c: OrgRuleConditions,
  defs: TransactionPropertyDefinition[],
  dataSourceNameById: Record<string, string>,
): string {
  const parts = c.conditions.map((row) => {
    const col = String(row.column);
    const lbl = columnLabel(col, defs);
    const kind = kindForRulesColumn(col, defs);
    const opL = opLabel(kind, row.op);
    const def = defs.find((p) => p.id === row.column);
    const isAccount = col === "data_source_id" || def?.type === "account";
    const pretty = (v?: string) => {
      if (!v) return "";
      if (isAccount) return dataSourceNameById[v] ?? v;
      return v;
    };
    if (!opNeedsValue(kind, row.op) && !opNeedsSecondValue(kind, row.op)) {
      return `${lbl} ${opL}`;
    }
    if (row.op === "between") {
      return `${lbl} ${opL} ${pretty(row.value) || "…"} – ${pretty(row.value2) || "…"}`;
    }
    const v = pretty(row.value ?? "");
    return `${lbl} ${opL} ${v ? `"${v.slice(0, 24)}${v.length > 24 ? "…" : ""}"` : "…"}`;
  });
  return c.op === "or" ? parts.join(" or ") : parts.join(" and ");
}

function summarizeActions(actions: OrgRuleAction[], propNames: Record<string, string>): string {
  return actions
    .map((a) => {
      if (a.type === "ai_categorize") return "AI categorize";
      if (a.type === "set_standard_field") {
        const lbl = ORG_RULE_STANDARD_FIELD_LABELS[a.field as OrgRuleStandardWritableField] ?? a.field;
        return `${lbl} → ${previewUnknownValue(a.value)}`;
      }
      if (a.type === "set_custom_property") {
        const name = propNames[a.propertyDefinitionId] ?? "Property";
        return `${name} → ${previewUnknownValue(a.value)}`;
      }
      return "action";
    })
    .join(", ");
}

function defaultConditions(): OrgRuleConditions {
  return {
    op: "and",
    conditions: [{ id: newConditionId(), column: "vendor", op: "contains", value: "Amazon" }],
  };
}

const defaultActions = (): OrgRuleAction[] => [{ type: "ai_categorize" }];

function parseConditionsJson(j: Json): OrgRuleConditions {
  const parsed = parseOrgRuleConditions(j as unknown);
  if (parsed) {
    return {
      ...parsed,
      conditions: parsed.conditions.map((c) => ({ ...c, id: c.id ?? newConditionId() })),
    };
  }
  return defaultConditions();
}

function parseActionsJson(j: Json): OrgRuleAction[] {
  const parsed = parseOrgRuleActions(j as unknown);
  if (parsed && parsed.length > 0) return parsed;
  return defaultActions();
}

function RuleConditionValueInputs({
  column,
  kind,
  cond,
  options,
  dataSources,
  def,
  onPatch,
}: {
  column: string;
  kind: ColumnFilterKind;
  cond: OrgRuleFilterCondition;
  options: { id: string; label: string }[];
  dataSources: DataSourceOpt[];
  def?: TransactionPropertyDefinition;
  onPatch: (patch: Partial<Pick<OrgRuleFilterCondition, "value" | "value2">>) => void;
}) {
  const needs2 = opNeedsSecondValue(kind, cond.op);

  if (column === "status") {
    return (
      <select
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
      >
        <option value="">Choose…</option>
        {FILTER_STATUS_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (column === "transaction_type") {
    return (
      <select
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
      >
        <option value="">Choose…</option>
        {FILTER_TRANSACTION_TYPE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (column === "source") {
    return (
      <select
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
      >
        <option value="">Choose…</option>
        {FILTER_SOURCE_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (column === "data_source_id" || def?.type === "account") {
    return (
      <select
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
      >
        <option value="">Choose account…</option>
        {dataSources.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "enum" && options.length > 0) {
    return (
      <select
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
      >
        <option value="">Choose…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "multi" && options.length > 0 && cond.op === "contains") {
    return (
      <select
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
      >
        <option value="">Choose option…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (kind === "date") {
    return (
      <div className="space-y-2">
        <input
          type="date"
          value={cond.value ?? ""}
          onChange={(e) => onPatch({ value: e.target.value })}
          className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
        />
        {needs2 ? (
          <input
            type="date"
            value={cond.value2 ?? ""}
            onChange={(e) => onPatch({ value2: e.target.value })}
            className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white"
          />
        ) : null}
      </div>
    );
  }

  if (kind === "number") {
    return (
      <input
        type="number"
        step="any"
        value={cond.value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        placeholder="Type a value…"
        className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white placeholder:text-mono-light"
      />
    );
  }

  return (
    <input
      type="text"
      value={cond.value ?? ""}
      onChange={(e) => onPatch({ value: e.target.value })}
      placeholder="Type a value…"
      className="w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white placeholder:text-mono-light"
    />
  );
}

type OrgMemberOpt = { id: string; display_name: string | null; email: string | null };

function RuleMultiSelectValue({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: unknown;
  onChange: (v: string[]) => void;
}) {
  const arr = Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : [];
  const toggle = (id: string) => {
    if (arr.includes(id)) onChange(arr.filter((x) => x !== id));
    else onChange([...arr, id]);
  };
  return (
    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto rounded-lg border border-black/10 p-2 bg-white">
      {options.map((o) => (
        <label key={o.id} className="flex items-center gap-2 text-sm text-mono-dark font-sans cursor-pointer">
          <input type="checkbox" checked={arr.includes(o.id)} onChange={() => toggle(o.id)} />
          <span className="truncate">{o.label}</span>
        </label>
      ))}
    </div>
  );
}

function RuleStandardFieldValueEditor({
  field,
  value,
  onChange,
}: {
  field: OrgRuleStandardWritableField;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const inp =
    "w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white placeholder:text-mono-light";

  switch (field) {
    case "status":
      return (
        <select
          value={typeof value === "string" ? value : "pending"}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        >
          {FILTER_STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "transaction_type":
      return (
        <select
          value={typeof value === "string" ? value : "expense"}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        >
          {FILTER_TRANSACTION_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "source":
      return (
        <select
          value={typeof value === "string" ? value : "manual"}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        >
          {FILTER_SOURCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case "schedule_c_line":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inp}
        >
          <option value="">Clear line</option>
          {SCHEDULE_C_LINES.map((l) => (
            <option key={l.line} value={l.line}>
              Line {l.line}: {l.label}
            </option>
          ))}
        </select>
      );
    case "deduction_percent": {
      const n = typeof value === "number" ? value : parseInt(String(value ?? "100"), 10);
      return (
        <input
          type="number"
          min={0}
          max={100}
          value={Number.isFinite(n) ? n : 100}
          onChange={(e) => onChange(parseInt(e.target.value, 10) || 0)}
          className={inp}
        />
      );
    }
    case "amount": {
      const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
      return (
        <input
          type="number"
          step="any"
          value={Number.isFinite(n) ? n : 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={inp}
        />
      );
    }
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
        />
      );
    case "notes":
    case "business_purpose":
    case "description":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className={inp}
          placeholder="Leave empty to clear"
        />
      );
    case "category":
    case "quick_label":
    case "vendor":
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={inp}
          placeholder={field === "vendor" ? "Required" : "Leave empty to clear"}
        />
      );
    default: {
      const _u: never = field;
      return _u;
    }
  }
}

function RuleCustomPropertyValueEditor({
  def,
  value,
  onChange,
  orgMembers,
}: {
  def: TransactionPropertyDefinition;
  value: unknown;
  onChange: (v: unknown) => void;
  orgMembers: OrgMemberOpt[];
}) {
  const inp =
    "w-full rounded-lg border border-black/10 px-2 py-2 text-sm text-mono-dark bg-white placeholder:text-mono-light";
  const options = selectOptionsFromDef(def);

  switch (def.type) {
    case "checkbox":
      return (
        <label className="flex items-center gap-2 text-sm text-mono-dark font-sans">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
          />
          Checked
        </label>
      );
    case "number": {
      const n = typeof value === "number" ? value : parseFloat(String(value ?? "0"));
      return (
        <input
          type="number"
          step="any"
          value={Number.isFinite(n) ? n : ""}
          onChange={(e) => {
            const t = e.target.value;
            onChange(t === "" ? null : parseFloat(t));
          }}
          className={inp}
          placeholder="Empty to clear"
        />
      );
    }
    case "date":
      return (
        <input
          type="date"
          value={typeof value === "string" ? value.slice(0, 10) : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inp}
        />
      );
    case "select":
      if (options.length > 0) {
        return (
          <select
            value={typeof value === "string" ? value : ""}
            onChange={(e) => onChange(e.target.value || null)}
            className={inp}
          >
            <option value="">Clear</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      return (
        <input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inp}
        />
      );
    case "multi_select":
      return <RuleMultiSelectValue options={options} value={value} onChange={onChange} />;
    case "long_text":
      return (
        <textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          rows={4}
          className={inp}
          placeholder="Leave empty to clear"
        />
      );
    case "short_text":
    case "phone":
    case "email":
      return (
        <input
          type={def.type === "email" ? "email" : "text"}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inp}
          placeholder="Leave empty to clear"
        />
      );
    case "org_user":
      return (
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value || null)}
          className={inp}
        >
          <option value="">None</option>
          {orgMembers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name?.trim() || m.email?.trim() || m.id.slice(0, 8)}
            </option>
          ))}
        </select>
      );
    default:
      return (
        <p className="text-xs text-mono-light font-sans">
          This property type cannot be set by rules.
        </p>
      );
  }
}

export function OrgRulesPageClient({
  initialRules,
  initialProperties,
}: {
  initialRules: OrgRuleRow[];
  initialProperties: PropDefRow[];
}) {
  const [rules, setRules] = useState<OrgRuleRow[]>(initialRules);
  const properties = initialProperties;
  const propertyDefs = useMemo(() => toPropDefs(properties), [properties]);
  const defsById = useMemo(() => new Map(propertyDefs.map((p) => [p.id, p])), [propertyDefs]);
  const orgPickable = useMemo(
    () => propertyDefs.filter((p) => p.type === "account" || !isSystemTransactionPropertyType(p.type)),
    [propertyDefs],
  );

  const [toast, setToast] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("New rule");
  const [applyTo, setApplyTo] = useState<OrgRuleTriggerMode>("new_and_existing");
  const [conditions, setConditions] = useState<OrgRuleConditions>(() => defaultConditions());
  const [actions, setActions] = useState<OrgRuleAction[]>(() => defaultActions());
  const [saving, setSaving] = useState(false);
  const [dataSources, setDataSources] = useState<DataSourceOpt[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMemberOpt[]>([]);

  const dataSourceNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of dataSources) {
      if (!d?.id) continue;
      m[d.id] = d.name;
    }
    return m;
  }, [dataSources]);

  const propNameById = useMemo(
    () => Object.fromEntries(properties.map((p) => [p.id, p.name])),
    [properties],
  );

  const actionableProps = useMemo(
    () =>
      propertyDefs.filter(
        (p) => !isSystemTransactionPropertyType(p.type) && p.type !== "account" && p.type !== "files",
      ),
    [propertyDefs],
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/data-sources?limit=200");
        if (!res.ok || cancelled) return;
        const j = await res.json();
        const rows = Array.isArray(j.data) ? j.data : [];
        const opts: DataSourceOpt[] = rows.map((r: { id?: string; name?: string; institution?: string }) => ({
          id: String(r.id ?? ""),
          name: String(r.name ?? r.institution ?? r.id ?? "").trim() || String(r.id ?? ""),
        }));
        if (!cancelled) setDataSources(opts.filter((o) => o.id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/orgs/members");
        if (!res.ok || cancelled) return;
        const j = await res.json();
        const rows = Array.isArray(j.members) ? j.members : [];
        const list: OrgMemberOpt[] = rows.map(
          (m: { id?: string; display_name?: string | null; email?: string | null }) => ({
            id: String(m.id ?? ""),
            display_name: m.display_name ?? null,
            email: m.email ?? null,
          }),
        );
        if (!cancelled) setOrgMembers(list.filter((m) => m.id));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch("/api/org/rules");
    if (!res.ok) return;
    const data = await res.json();
    setRules(data.rules ?? []);
  }, []);

  const openNew = () => {
    setEditingId(null);
    setName("New rule");
    setApplyTo("new_and_existing");
    setConditions(defaultConditions());
    setActions(defaultActions());
    setModalOpen(true);
  };

  const openEdit = (r: OrgRuleRow) => {
    setEditingId(r.id);
    setName(r.name);
    setApplyTo(normalizeRuleApplyTo(r.trigger_mode));
    setConditions(parseConditionsJson(r.conditions_json));
    setActions(parseActionsJson(r.actions_json));
    setModalOpen(true);
  };

  const saveRule = async () => {
    setSaving(true);
    try {
      const payload = {
        name,
        conditions,
        actions,
        trigger_mode: applyTo,
      };
      const res = editingId
        ? await fetch(`/api/org/rules/${editingId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/org/rules", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast(data.error ?? "Save failed");
        return;
      }
      setModalOpen(false);
      setToast(editingId ? "Rule updated" : "Rule created");
      await reload();
    } finally {
      setSaving(false);
    }
  };

  const toggleEnabled = async (r: OrgRuleRow) => {
    const res = await fetch(`/api/org/rules/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !r.enabled }),
    });
    if (res.ok) {
      await reload();
      setToast(r.enabled ? "Rule paused" : "Rule enabled");
    }
  };

  const deleteRule = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    const res = await fetch(`/api/org/rules/${id}`, { method: "DELETE" });
    if (res.ok) {
      await reload();
      setToast("Rule deleted");
    }
  };

  const runFullBackfill = async (ruleId: string) => {
    if (!confirm("Run this rule on all transactions in your org? This can take a while.")) return;
    setToast("Running…");
    const res = await fetch("/api/org/rules/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "once_backfill", ruleId }),
    });
    const data = await res.json().catch(() => ({}));
    console.log("[org-rules] backfill response:", JSON.stringify(data, null, 2));
    if (res.ok) {
      const parts = [`${data.matchCount ?? 0} matched`, `${data.updateCount ?? 0} updated`];
      if (data.aiCount) parts.push(`${data.aiCount} AI`);
      if (data.scanned) parts.push(`${data.scanned} scanned`);
      const errs = Array.isArray(data.errors) ? data.errors : [];
      if (errs.length > 0) {
        parts.push(`${errs.length} error(s)`);
        console.warn("[org-rules] backfill errors:", errs);
      }
      let msg = `Done: ${parts.join(", ")}`;
      if (errs.length > 0) {
        msg += ` — ${errs[0]}`;
      }
      setToast(msg);
      await reload();
    } else {
      setToast(data.error ?? "Run failed");
    }
  };

  const addCondition = () => {
    const firstCol = "vendor" as const;
    const kind = kindForRulesColumn(firstCol, propertyDefs);
    setConditions((c) => ({
      ...c,
      conditions: [
        ...c.conditions,
        {
          id: newConditionId(),
          column: firstCol,
          op: defaultOpForKind(kind),
          value: "",
          value2: "",
        },
      ],
    }));
  };

  const setColumnForCondition = (index: number, column: string) => {
    setConditions((c) => {
      const next = [...c.conditions];
      const cur = next[index];
      if (!cur) return c;
      const kind = kindForRulesColumn(column, propertyDefs);
      next[index] = {
        ...cur,
        column: column as OrgRuleFilterCondition["column"],
        op: defaultOpForKind(kind),
        value: "",
        value2: "",
      };
      return { ...c, conditions: next };
    });
  };

  const setOpForCondition = (index: number, op: string) => {
    setConditions((c) => {
      const next = [...c.conditions];
      const cur = next[index];
      if (!cur) return c;
      next[index] = {
        ...cur,
        op,
        ...(op !== "between" ? { value2: "" } : {}),
      };
      return { ...c, conditions: next };
    });
  };

  const patchCondition = (index: number, patch: Partial<OrgRuleFilterCondition>) => {
    setConditions((c) => {
      const next = [...c.conditions];
      const cur = next[index];
      if (!cur) return c;
      next[index] = { ...cur, ...patch };
      return { ...c, conditions: next };
    });
  };

  const removeCondition = (index: number) => {
    setConditions((c) => ({
      ...c,
      conditions: c.conditions.filter((_, i) => i !== index),
    }));
  };

  const addAction = (kind: "ai_categorize" | "set_standard_field" | "set_custom_property") => {
    if (kind === "ai_categorize") setActions((a) => [...a, { type: "ai_categorize" }]);
    if (kind === "set_standard_field") {
      const field: OrgRuleStandardWritableField = "category";
      setActions((a) => [
        ...a,
        { type: "set_standard_field", field, value: defaultStandardRuleValue(field) },
      ]);
    }
    if (kind === "set_custom_property" && actionableProps[0]) {
      const def = actionableProps[0];
      setActions((a) => [
        ...a,
        {
          type: "set_custom_property",
          propertyDefinitionId: def.id,
          value: defaultCustomRuleValue(def),
        },
      ]);
    }
  };

  const updateAction = (index: number, next: OrgRuleAction) => {
    setActions((a) => {
      const copy = [...a];
      copy[index] = next;
      return copy;
    });
  };

  const removeAction = (index: number) => {
    setActions((a) => a.filter((_, i) => i !== index));
  };

  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-[28px] md:text-[32px] font-normal tracking-tight text-mono-dark font-sans">
          Rules
        </h1>
        <p className="text-sm text-mono-medium font-sans leading-relaxed">
          Automate categorization and properties when transactions match conditions. AI runs first, then other
          actions.{" "}
          <Link href="/preferences/org" className="underline underline-offset-2 text-mono-dark">
            Workspace automations
          </Link>
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={openNew}
          className="rounded-full bg-mono-dark text-white px-5 py-2.5 text-sm font-medium font-sans shadow-sm hover:opacity-90 transition-opacity"
        >
          New rule
        </button>
      </div>

      <div className="rounded-2xl border border-black/[0.08] bg-white/80 backdrop-blur-sm overflow-hidden shadow-[0_2px_24px_rgba(0,0,0,0.04)]">
        {rules.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-mono-medium font-sans">
            No org rules yet. Each rule&apos;s &quot;Apply to&quot; setting controls new imports, existing data
            (daily pass), or both.
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {rules.map((r) => (
              <li key={r.id} className="flex items-start gap-3 px-4 py-3.5 hover:bg-black/[0.02] transition-colors">
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.enabled}
                  onClick={() => toggleEnabled(r)}
                  className={`mt-0.5 relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${
                    r.enabled ? "bg-[#34C759]" : "bg-black/15"
                  }`}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-sm transition-transform ${
                      r.enabled ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[15px] font-medium text-mono-dark font-sans truncate">{r.name}</span>
                    <span className="text-[11px] uppercase tracking-wide text-mono-light font-sans">
                      {APPLY_TO_SHORT_LABEL[normalizeRuleApplyTo(r.trigger_mode)]}
                    </span>
                  </div>
                  <p className="text-xs text-mono-medium font-sans mt-1 leading-relaxed">
                    If {summarizeConditions(parseConditionsJson(r.conditions_json), propertyDefs, dataSourceNameById)} →{" "}
                    {summarizeActions(parseActionsJson(r.actions_json), propNameById)}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="text-xs font-medium text-[#007AFF] font-sans"
                    >
                      Edit
                    </button>
                    {orgRuleAllowsFullBackfill(normalizeRuleApplyTo(r.trigger_mode)) && (
                      <button
                        type="button"
                        onClick={() => runFullBackfill(r.id)}
                        className="text-xs font-medium text-[#007AFF] font-sans"
                      >
                        Run on all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteRule(r.id)}
                      className="text-xs font-medium text-red-600/90 font-sans"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/35 backdrop-blur-[3px] p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-[#F2F2F7] shadow-xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b border-black/[0.06] bg-[#F2F2F7]/95 backdrop-blur-md">
              <h2 className="text-[17px] font-semibold text-mono-dark font-sans">
                {editingId ? "Edit rule" : "New rule"}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-[#007AFF] text-[17px] font-normal font-sans"
              >
                Cancel
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="rounded-xl bg-white border border-black/[0.06] overflow-hidden">
                <label className="block px-3 pt-3 text-xs text-mono-light font-sans uppercase tracking-wide">
                  Name
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 pb-3 pt-1 text-[17px] text-mono-dark bg-transparent outline-none font-sans"
                />
              </div>

              <div className="rounded-xl bg-white border border-black/[0.06] overflow-hidden">
                <label className="block px-3 pt-3 text-xs text-mono-light font-sans uppercase tracking-wide">
                  Apply to
                </label>
                <select
                  value={applyTo}
                  onChange={(e) => setApplyTo(e.target.value as OrgRuleTriggerMode)}
                  className="w-full px-3 pb-3 pt-1 text-[16px] text-mono-dark bg-transparent outline-none font-sans"
                >
                  {APPLY_TO_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[13px] font-semibold text-mono-dark/80 font-sans uppercase tracking-wide">
                    Conditions
                  </span>
                  <div className="flex gap-2 items-center">
                    <select
                      value={conditions.op}
                      onChange={(e) =>
                        setConditions((c) => ({ ...c, op: e.target.value as "and" | "or" }))
                      }
                      className="text-xs rounded-lg border border-black/10 px-2 py-1 bg-white"
                    >
                      <option value="and">All match (AND)</option>
                      <option value="or">Any match (OR)</option>
                    </select>
                    <button
                      type="button"
                      onClick={addCondition}
                      className="text-xs text-[#007AFF] font-medium font-sans"
                    >
                      Add
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  {conditions.conditions.map((cond, i) => {
                    const col = String(cond.column);
                    const kind = kindForRulesColumn(col, propertyDefs);
                    const ops = opsForKind(kind);
                    const def = !isStandardFilterableColumn(col) ? defsById.get(col) : undefined;
                    const options = selectOptionsFromDef(def);
                    return (
                      <div
                        key={cond.id ?? i}
                        className="rounded-xl bg-white border border-black/[0.06] p-3 space-y-2"
                      >
                        <div className="flex gap-2 flex-wrap">
                          <select
                            value={col}
                            onChange={(e) => setColumnForCondition(i, e.target.value)}
                            className="text-sm rounded-lg border border-black/10 px-2 py-1.5 bg-white flex-1 min-w-[120px]"
                          >
                            {ACTIVITY_FILTERABLE_STANDARD_COLUMNS.map((c) => (
                              <option key={c} value={c}>
                                {ACTIVITY_STANDARD_COLUMN_LABELS[c]}
                              </option>
                            ))}
                            {orgPickable.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          <select
                            value={cond.op}
                            onChange={(e) => setOpForCondition(i, e.target.value)}
                            className="text-sm rounded-lg border border-black/10 px-2 py-1.5 bg-white flex-1 min-w-[100px]"
                          >
                            {ops.map((op) => (
                              <option key={op} value={op}>
                                {opLabel(kind, op)}
                              </option>
                            ))}
                          </select>
                        </div>
                        {opNeedsValue(kind, cond.op) || opNeedsSecondValue(kind, cond.op) ? (
                          <RuleConditionValueInputs
                            column={col}
                            kind={kind}
                            cond={cond}
                            options={options}
                            dataSources={dataSources}
                            def={def}
                            onPatch={(patch) => patchCondition(i, patch)}
                          />
                        ) : (
                          <p className="text-xs text-mono-light font-sans">No value needed for this condition.</p>
                        )}
                        {conditions.conditions.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeCondition(i)}
                            className="text-xs text-red-600 font-sans"
                          >
                            Remove condition
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[13px] font-semibold text-mono-dark/80 font-sans uppercase tracking-wide">
                    Actions
                  </span>
                  <div className="flex flex-wrap gap-2 justify-end">
                    <button
                      type="button"
                      onClick={() => addAction("ai_categorize")}
                      className="text-xs text-[#007AFF] font-medium font-sans"
                    >
                      + AI
                    </button>
                    <button
                      type="button"
                      onClick={() => addAction("set_standard_field")}
                      className="text-xs text-[#007AFF] font-medium font-sans"
                    >
                      + Field
                    </button>
                    {actionableProps.length > 0 && (
                      <button
                        type="button"
                        onClick={() => addAction("set_custom_property")}
                        className="text-xs text-[#007AFF] font-medium font-sans"
                      >
                        + Property
                      </button>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  {actions.map((act, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-white border border-black/[0.06] p-3 space-y-2"
                    >
                      {act.type === "ai_categorize" && (
                        <p className="text-sm text-mono-dark font-sans">AI categorization (runs before other actions)</p>
                      )}
                      {act.type === "set_standard_field" && (
                        <div className="space-y-2">
                          <select
                            value={act.field}
                            onChange={(e) => {
                              const f = e.target.value as OrgRuleStandardWritableField;
                              updateAction(i, {
                                type: "set_standard_field",
                                field: f,
                                value: defaultStandardRuleValue(f),
                              });
                            }}
                            className="w-full text-sm rounded-lg border border-black/10 px-2 py-2 bg-white"
                          >
                            {ORG_RULE_STANDARD_WRITABLE_FIELDS.map((f) => (
                              <option key={f} value={f}>
                                {ORG_RULE_STANDARD_FIELD_LABELS[f]}
                              </option>
                            ))}
                          </select>
                          <RuleStandardFieldValueEditor
                            field={act.field as OrgRuleStandardWritableField}
                            value={act.value}
                            onChange={(v) => updateAction(i, { ...act, value: v })}
                          />
                        </div>
                      )}
                      {act.type === "set_custom_property" && (
                        <div className="space-y-2">
                          <select
                            value={act.propertyDefinitionId}
                            onChange={(e) => {
                              const pid = e.target.value;
                              const def = actionableProps.find((p) => p.id === pid);
                              updateAction(i, {
                                type: "set_custom_property",
                                propertyDefinitionId: pid,
                                value: def ? defaultCustomRuleValue(def) : "",
                              });
                            }}
                            className="w-full text-sm rounded-lg border border-black/10 px-2 py-2 bg-white"
                          >
                            {actionableProps.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                          {(() => {
                            const def = actionableProps.find((p) => p.id === act.propertyDefinitionId);
                            if (!def) {
                              return (
                                <p className="text-xs text-mono-light font-sans">Unknown property</p>
                              );
                            }
                            return (
                              <RuleCustomPropertyValueEditor
                                def={def}
                                value={act.value}
                                onChange={(v) => updateAction(i, { ...act, value: v })}
                                orgMembers={orgMembers}
                              />
                            );
                          })()}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeAction(i)}
                        className="text-xs text-red-600 font-sans"
                      >
                        Remove action
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 p-4 border-t border-black/[0.06] bg-[#F2F2F7]">
              <button
                type="button"
                disabled={saving || conditions.conditions.length === 0 || actions.length === 0}
                onClick={saveRule}
                className="w-full rounded-xl bg-[#007AFF] text-white py-3 text-[17px] font-semibold font-sans disabled:opacity-40"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-mono-dark/95 px-5 py-2.5 text-sm text-white shadow-lg z-[60] max-w-[90vw] text-center font-sans">
          {toast}
          <button
            type="button"
            className="ml-2 opacity-80"
            onClick={() => setToast(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
