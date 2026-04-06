"use client";

import { useCallback, useState } from "react";
import type { TransactionPropertyDefinition } from "@/lib/transaction-property-definition";
import { isSystemTransactionPropertyType } from "@/lib/transaction-property-types";
import { formatUSPhone, parseUSPhone, displayUSPhone } from "@/lib/format-us-phone";
import { NotionStylePropertyRow } from "@/components/NotionStylePropertyRow";
import { transactionPropertyTypeIcon } from "@/lib/transaction-detail-property-icons";

type TxLike = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function systemDisplay(
  def: TransactionPropertyDefinition,
  t: TxLike,
  memberDisplayById: Record<string, string>
): React.ReactNode {
  switch (def.type) {
    case "created_time":
      return t.created_at
        ? new Date(t.created_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })
        : "—";
    case "created_by":
      return memberDisplayById[t.user_id] || "—";
    case "last_edited_date":
      return t.updated_at ? formatDateShort(t.updated_at) : "—";
    case "last_edited_time":
      return t.updated_at
        ? new Date(t.updated_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : "—";
    default:
      return "—";
  }
}

export type OrgMemberOption = { id: string; display_name: string | null; email: string | null };

type Props = {
  definitions: TransactionPropertyDefinition[];
  transaction: TxLike;
  editable: boolean;
  editCustomFields: Record<string, unknown>;
  setEditCustomFields: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  memberDisplayById: Record<string, string>;
  orgMembers: OrgMemberOption[];
};

export function TransactionDetailCustomFields({
  definitions,
  transaction,
  editable,
  editCustomFields,
  setEditCustomFields,
  memberDisplayById,
  orgMembers,
}: Props) {
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  const setVal = useCallback((propId: string, v: unknown) => {
    setEditCustomFields((prev) => ({ ...prev, [propId]: v }));
  }, [setEditCustomFields]);

  const sorted = [...definitions].sort((a, b) => a.position - b.position);
  if (sorted.length === 0 && !editable) return null;

  async function onPickFile(propId: string, file: File | null) {
    if (!file) return;
    setUploadingKey(propId);
    try {
      const fd = new FormData();
      fd.set("propertyId", propId);
      fd.set("file", file);
      const res = await fetch(`/api/transactions/${transaction.id}/property-files`, {
        method: "POST",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error ?? "Upload failed");
      const ref = (body as { file?: { path: string; name: string; mime?: string; size?: number } }).file;
      if (!ref?.path) throw new Error("Invalid upload response");
      const prev = (editCustomFields[propId] as unknown[]) ?? [];
      const list = Array.isArray(prev) ? [...prev] : [];
      list.push({ path: ref.path, name: ref.name, mime: ref.mime, size: ref.size });
      setVal(propId, list);
    } catch (e) {
      console.error(e);
    } finally {
      setUploadingKey(null);
    }
  }

  return (
    <>
      <div className="border-t border-bg-tertiary/40 my-2 pt-2">
        <p className="text-[10px] font-medium text-mono-light uppercase tracking-wider px-0 pb-2">Org properties</p>
        {sorted.length === 0 && editable && (
          <p className="text-xs text-mono-light pb-3">
            No custom properties yet. Add one below to use it as a column and field here.
          </p>
        )}
        {sorted.map((def) => {
          const raw = editCustomFields[def.id];

          if (isSystemTransactionPropertyType(def.type)) {
            return (
              <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                {systemDisplay(def, transaction, memberDisplayById)}
              </NotionStylePropertyRow>
            );
          }

          if (!editable) {
            const v = raw;
            if (v === undefined || v === null || v === "") return (
              <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                <span className="text-mono-light text-xs">—</span>
              </NotionStylePropertyRow>
            );
            if (def.type === "checkbox") return (
              <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                {v === true ? "Yes" : "No"}
              </NotionStylePropertyRow>
            );
            if (def.type === "multi_select" && Array.isArray(v)) {
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  {v.length ? v.join(", ") : "—"}
                </NotionStylePropertyRow>
              );
            }
            if (def.type === "files" && Array.isArray(v)) {
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name} alignTop>
                  <ul className="text-xs space-y-0.5">
                    {v.map((f, i) => (
                      <li key={i}>{typeof f === "object" && f && "name" in f ? String((f as { name: string }).name) : "file"}</li>
                    ))}
                  </ul>
                </NotionStylePropertyRow>
              );
            }
            return (
              <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                <span className="text-xs break-words">{String(v)}</span>
              </NotionStylePropertyRow>
            );
          }

          const opts = Array.isArray(def.config?.options)
            ? (def.config!.options as { id: string; label: string }[])
            : [];

          switch (def.type) {
            case "select":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <select
                    value={raw == null ? "" : String(raw)}
                    onChange={(e) => setVal(def.id, e.target.value || null)}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {opts.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </NotionStylePropertyRow>
              );
            case "multi_select": {
              const selected = Array.isArray(raw) ? (raw as string[]) : [];
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name} alignTop>
                  <div className="flex flex-col gap-1.5">
                    {opts.map((o) => (
                      <label key={o.id} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={selected.includes(o.id)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...selected, o.id]
                              : selected.filter((x) => x !== o.id);
                            setVal(def.id, next);
                          }}
                          className="rounded border-bg-tertiary"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                </NotionStylePropertyRow>
              );
            }
            case "date":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <input
                    type="date"
                    value={raw == null || raw === "" ? "" : String(raw).slice(0, 10)}
                    onChange={(e) => setVal(def.id, e.target.value || null)}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
                  />
                </NotionStylePropertyRow>
              );
            case "short_text":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <input
                    type="text"
                    value={raw == null ? "" : String(raw)}
                    onChange={(e) => setVal(def.id, e.target.value || null)}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
                  />
                </NotionStylePropertyRow>
              );
            case "long_text":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name} alignTop>
                  <textarea
                    value={raw == null ? "" : String(raw)}
                    onChange={(e) => setVal(def.id, e.target.value || null)}
                    rows={3}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white resize-none"
                  />
                </NotionStylePropertyRow>
              );
            case "checkbox":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={raw === true}
                      onChange={(e) => setVal(def.id, e.target.checked)}
                      className="rounded border-bg-tertiary"
                    />
                    Yes
                  </label>
                </NotionStylePropertyRow>
              );
            case "number":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <input
                    type="number"
                    step="any"
                    value={raw == null || raw === "" ? "" : String(raw)}
                    onChange={(e) => {
                      const t = e.target.value;
                      setVal(def.id, t === "" ? null : Number(t));
                    }}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white tabular-nums"
                  />
                </NotionStylePropertyRow>
              );
            case "org_user":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <select
                    value={raw == null ? "" : String(raw)}
                    onChange={(e) => setVal(def.id, e.target.value || null)}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
                  >
                    <option value="">—</option>
                    {orgMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name?.trim() || m.email?.trim() || m.id.slice(0, 8)}
                      </option>
                    ))}
                  </select>
                </NotionStylePropertyRow>
              );
            case "phone":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <input
                    type="text"
                    inputMode="tel"
                    value={raw == null ? "" : formatUSPhone(displayUSPhone(String(raw)))}
                    onChange={(e) => setVal(def.id, parseUSPhone(e.target.value) || null)}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
                  />
                </NotionStylePropertyRow>
              );
            case "email":
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name}>
                  <input
                    type="email"
                    value={raw == null ? "" : String(raw)}
                    onChange={(e) => setVal(def.id, e.target.value.trim() || null)}
                    className="w-full border border-[#F0F1F7] rounded-none px-2 py-1.5 text-sm bg-white"
                  />
                </NotionStylePropertyRow>
              );
            case "files": {
              const list = Array.isArray(raw) ? (raw as { path: string; name: string }[]) : [];
              return (
                <NotionStylePropertyRow icon={transactionPropertyTypeIcon(def.type)} key={def.id} label={def.name} alignTop>
                  <div className="space-y-2">
                    <ul className="text-xs space-y-1">
                      {list.map((f, i) => (
                        <li key={f.path} className="flex items-center justify-between gap-2">
                          <span className="truncate">{f.name}</span>
                          <button
                            type="button"
                            className="shrink-0 text-[11px] text-red-600 hover:underline"
                            onClick={() => setVal(def.id, list.filter((_, j) => j !== i))}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                    <label className="inline-flex items-center gap-2 text-xs text-sovereign-blue cursor-pointer">
                      <input
                        type="file"
                        className="sr-only"
                        disabled={uploadingKey === def.id}
                        onChange={(e) => void onPickFile(def.id, e.target.files?.[0] ?? null)}
                      />
                      {uploadingKey === def.id ? "Uploading…" : "Add file"}
                    </label>
                  </div>
                </NotionStylePropertyRow>
              );
            }
            default:
              return null;
          }
        })}
      </div>
    </>
  );
}
