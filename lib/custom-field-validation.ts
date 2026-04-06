import { z } from "zod";
import type { TransactionPropertyType } from "@/lib/transaction-property-types";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import { parseUSPhone } from "@/lib/format-us-phone";

export type PropertyDefinitionRow = {
  id: string;
  type: string;
  config: Record<string, unknown> | null;
};

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function optionIds(config: Record<string, unknown> | null): Set<string> {
  const raw = config?.options;
  if (!Array.isArray(raw)) return new Set();
  const ids = new Set<string>();
  for (const o of raw) {
    if (o && typeof o === "object" && typeof (o as { id?: unknown }).id === "string") {
      ids.add((o as { id: string }).id);
    }
  }
  return ids;
}

const fileRefSchema = z.object({
  path: z.string().min(1).max(500),
  name: z.string().min(1).max(500),
  mime: z.string().max(200).optional(),
  size: z.number().int().min(0).optional(),
});

/**
 * Validate a single value for a property definition. Returns normalized JSON value or error message.
 */
export function validateCustomFieldValue(
  def: PropertyDefinitionRow,
  value: unknown
): { ok: true; value: unknown } | { ok: false; error: string } {
  const t = def.type as TransactionPropertyType;
  if (isSystemTransactionPropertyType(def.type)) {
    return { ok: false, error: "System properties are not stored in custom_fields" };
  }

  const config = def.config && typeof def.config === "object" ? def.config as Record<string, unknown> : null;
  const allowed = optionIds(config);

  switch (t) {
    case "select": {
      if (value === null || value === "") return { ok: true, value: null };
      const s = z.string().max(200).safeParse(value);
      if (!s.success) return { ok: false, error: "Invalid select value" };
      if (allowed.size > 0 && !allowed.has(s.data)) return { ok: false, error: "Invalid option" };
      return { ok: true, value: s.data };
    }
    case "multi_select": {
      if (value === null) return { ok: true, value: [] };
      const arr = z.array(z.string().max(200)).max(50).safeParse(value);
      if (!arr.success) return { ok: false, error: "Invalid multi-select" };
      if (allowed.size > 0) {
        for (const x of arr.data) {
          if (!allowed.has(x)) return { ok: false, error: "Invalid option" };
        }
      }
      return { ok: true, value: arr.data };
    }
    case "date": {
      if (value === null || value === "") return { ok: true, value: null };
      const d = isoDate.safeParse(value);
      if (!d.success) return { ok: false, error: "Invalid date" };
      return { ok: true, value: d.data };
    }
    case "short_text": {
      if (value === null || value === "") return { ok: true, value: null };
      const s = z.string().max(500).safeParse(value);
      if (!s.success) return { ok: false, error: "Text too long" };
      return { ok: true, value: s.data };
    }
    case "long_text": {
      if (value === null || value === "") return { ok: true, value: null };
      const s = z.string().max(10000).safeParse(value);
      if (!s.success) return { ok: false, error: "Text too long" };
      return { ok: true, value: s.data };
    }
    case "checkbox": {
      const b = z.boolean().safeParse(value);
      if (!b.success) return { ok: false, error: "Invalid checkbox" };
      return { ok: true, value: b.data };
    }
    case "number": {
      if (value === null || value === "") return { ok: true, value: null };
      const n = z.number().finite().safeParse(value);
      if (!n.success) return { ok: false, error: "Invalid number" };
      return { ok: true, value: n.data };
    }
    case "org_user": {
      if (value === null || value === "") return { ok: true, value: null };
      const u = z.string().uuid().safeParse(value);
      if (!u.success) return { ok: false, error: "Invalid user id" };
      return { ok: true, value: u.data };
    }
    case "phone": {
      if (value === null || value === "") return { ok: true, value: null };
      const s = z.string().safeParse(value);
      if (!s.success) return { ok: false, error: "Invalid phone" };
      const digits = parseUSPhone(s.data);
      if (digits.length > 0 && digits.length < 10) return { ok: false, error: "Phone must be 10 digits" };
      return { ok: true, value: digits || null };
    }
    case "email": {
      if (value === null || value === "") return { ok: true, value: null };
      const e = z.string().email().max(320).safeParse(value);
      if (!e.success) return { ok: false, error: "Invalid email" };
      return { ok: true, value: e.data };
    }
    case "files": {
      if (value === null) return { ok: true, value: [] };
      const arr = z.array(fileRefSchema).max(20).safeParse(value);
      if (!arr.success) return { ok: false, error: "Invalid files" };
      for (const f of arr.data) {
        const parts = f.path.split("/");
        if (parts.length < 3) return { ok: false, error: "Invalid file path" };
      }
      return { ok: true, value: arr.data };
    }
    default:
      return { ok: false, error: "Unknown property type" };
  }
}

/** Merge patch into existing custom_fields; only keys present in definitions (non-system) are applied. */
export function mergeCustomFieldsPatch(
  existing: Record<string, unknown>,
  patch: Record<string, unknown>,
  definitionsById: Map<string, PropertyDefinitionRow>
): { ok: true; merged: Record<string, unknown> } | { ok: false; error: string } {
  const merged = { ...existing };
  for (const [key, val] of Object.entries(patch)) {
    const def = definitionsById.get(key);
    if (!def) return { ok: false, error: `Unknown property: ${key}` };
    if (isSystemTransactionPropertyType(def.type)) {
      return { ok: false, error: `Cannot set system property: ${key}` };
    }
    if (val === undefined) continue;
    if (val === null) {
      delete merged[key];
      continue;
    }
    const r = validateCustomFieldValue(def, val);
    if (!r.ok) return { ok: false, error: r.error };
    merged[key] = r.value;
  }
  return { ok: true, merged };
}
