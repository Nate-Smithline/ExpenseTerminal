"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  TRANSACTION_PROPERTY_TYPES,
  type TransactionPropertyType,
} from "@/lib/validation/schemas";
import { transactionPropertyTypeIcon } from "@/lib/transaction-detail-property-icons";

const TYPE_LABELS: Record<TransactionPropertyType, string> = {
  multi_select: "Multi-select",
  select: "Select",
  date: "Date",
  short_text: "Text",
  long_text: "Long text",
  checkbox: "Checkbox",
  org_user: "Person",
  number: "Number",
  files: "Files & media",
  phone: "Phone",
  email: "Email",
  created_time: "Created time",
  created_by: "Created by",
  last_edited_date: "Last edited (date)",
  last_edited_time: "Last edited (time)",
};

const SUGGESTED: TransactionPropertyType[] = ["short_text", "number", "select", "date", "org_user"];

const ICON_SX = {
  fontSize: 18,
  fontVariationSettings: "'FILL' 0, 'wght' 400, 'grad' 0, 'opsz' 24",
} as const;

function parseOptionsFromLines(text: string): { id: string; label: string }[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((label) => ({ id: crypto.randomUUID(), label: label.slice(0, 200) }));
}

function filterTypes(query: string): TransactionPropertyType[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...TRANSACTION_PROPERTY_TYPES];
  return TRANSACTION_PROPERTY_TYPES.filter((t) => TYPE_LABELS[t].toLowerCase().includes(q));
}

type Props = {
  onRefresh: () => Promise<void>;
};

type Step = "idle" | "types" | "details";

export function TransactionPropertySidebarCreate({ onRefresh }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("idle");
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<TransactionPropertyType | null>(null);
  const [name, setName] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsOptions = selectedType === "select" || selectedType === "multi_select";

  const reset = useCallback(() => {
    setSearch("");
    setSelectedType(null);
    setName("");
    setOptionsText("");
    setError(null);
  }, []);

  const closeAll = useCallback(() => {
    setStep("idle");
    reset();
  }, [reset]);

  useEffect(() => {
    if (step === "idle") return;
    function onDocMouseDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeAll();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") closeAll();
    }
    document.addEventListener("mousedown", onDocMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [step, closeAll]);

  useEffect(() => {
    if (step === "details") {
      const t = window.setTimeout(() => nameInputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
  }, [step]);

  const pickType = (t: TransactionPropertyType) => {
    setSelectedType(t);
    setStep("details");
    setError(null);
  };

  const handleCreate = async () => {
    if (!selectedType) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required");
      return;
    }
    let config: Record<string, unknown> = {};
    if (selectedType === "select" || selectedType === "multi_select") {
      const opts = parseOptionsFromLines(optionsText);
      if (opts.length === 0) {
        setError("Add at least one option (one per line)");
        return;
      }
      config = { options: opts };
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/org/transaction-properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          type: selectedType,
          config: Object.keys(config).length ? config : undefined,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof body.error === "string" ? body.error : "Failed to create property");
        return;
      }
      closeAll();
      await onRefresh();
    } catch {
      setError("Failed to create property");
    } finally {
      setSaving(false);
    }
  };

  const filtered = filterTypes(search);
  const suggestedFiltered = SUGGESTED.filter((t) => filtered.includes(t));
  const restFiltered = filtered.filter((t) => !SUGGESTED.includes(t));

  return (
    <div ref={rootRef} className="relative mt-2 border-t border-bg-tertiary/40 pt-2">
      {step === "idle" && (
        <button
          type="button"
          onClick={() => {
            setStep("types");
            setSearch("");
            setError(null);
          }}
          className="flex w-full items-center gap-2 rounded-md py-2 pl-1 pr-2 text-left text-xs font-medium text-mono-medium transition hover:bg-bg-secondary/70"
        >
          <span className="material-symbols-rounded text-[18px] text-mono-light" style={ICON_SX}>
            add
          </span>
          Add a property
        </button>
      )}

      {step === "types" && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 flex max-h-[min(70vh,340px)] flex-col overflow-hidden rounded-lg border border-bg-tertiary/50 bg-white shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]">
          <div className="border-b border-bg-tertiary/40 p-2">
            <div className="flex items-center gap-2 rounded-md border border-bg-tertiary/50 bg-bg-secondary/20 px-2 py-1.5">
              <span className="material-symbols-rounded text-[18px] text-mono-light">title</span>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search or add a property…"
                className="min-w-0 flex-1 bg-transparent text-sm text-mono-dark placeholder:text-mono-light focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
            {suggestedFiltered.length > 0 && (
              <>
                <p className="px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-mono-light">
                  Suggested
                </p>
                {suggestedFiltered.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => pickType(t)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-mono-dark hover:bg-bg-secondary/80"
                  >
                    <span className="material-symbols-rounded text-mono-medium" style={ICON_SX}>
                      {transactionPropertyTypeIcon(t)}
                    </span>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </>
            )}
            <div className="mt-1 flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-medium uppercase tracking-wider text-mono-light">
              <span className="material-symbols-rounded text-[14px]">search</span>
              Type
            </div>
            {restFiltered.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => pickType(t)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-mono-dark hover:bg-bg-secondary/80"
              >
                <span className="material-symbols-rounded text-mono-medium" style={ICON_SX}>
                  {transactionPropertyTypeIcon(t)}
                </span>
                {TYPE_LABELS[t]}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-xs text-mono-light">No matching types</p>
            )}
          </div>
        </div>
      )}

      {step === "details" && selectedType && (
        <div className="absolute left-0 right-0 top-full z-[60] mt-1 overflow-hidden rounded-lg border border-bg-tertiary/50 bg-white shadow-[0_8px_30px_-8px_rgba(0,0,0,0.18)]">
          <div className="flex items-center gap-1 border-b border-bg-tertiary/40 px-1 py-1">
            <button
              type="button"
              onClick={() => {
                setStep("types");
                setSelectedType(null);
                setName("");
                setOptionsText("");
                setError(null);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-md text-mono-medium hover:bg-bg-secondary/80"
              aria-label="Back"
            >
              <span className="material-symbols-rounded text-[20px]">arrow_back</span>
            </button>
            <div className="flex min-w-0 flex-1 items-center gap-2 px-1">
              <span className="material-symbols-rounded shrink-0 text-mono-medium" style={ICON_SX}>
                {transactionPropertyTypeIcon(selectedType)}
              </span>
              <span className="truncate text-sm font-medium text-mono-dark">{TYPE_LABELS[selectedType]}</span>
            </div>
          </div>
          <div className="space-y-3 p-3">
            <div>
              <label htmlFor="tp-sidebar-name" className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-mono-light">
                Name
              </label>
              <input
                ref={nameInputRef}
                id="tp-sidebar-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Property name"
                maxLength={200}
                className="w-full rounded-md border border-[#F0F1F7] bg-white px-2 py-2 text-sm focus:border-mono-medium/25 focus:outline-none"
              />
            </div>
            {needsOptions && (
              <div>
                <label htmlFor="tp-sidebar-options" className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-mono-light">
                  Options (one per line)
                </label>
                <textarea
                  id="tp-sidebar-options"
                  value={optionsText}
                  onChange={(e) => setOptionsText(e.target.value)}
                  rows={4}
                  placeholder={"Option A\nOption B"}
                  className="w-full resize-none rounded-md border border-[#F0F1F7] bg-white px-2 py-2 font-mono text-xs focus:border-mono-medium/25 focus:outline-none"
                />
              </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleCreate()}
                className="flex-1 rounded-md bg-mono-dark px-3 py-2 text-xs font-semibold text-white hover:bg-mono-dark/90 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={closeAll}
                className="rounded-md border border-bg-tertiary px-3 py-2 text-xs font-medium text-mono-medium hover:bg-bg-secondary/80"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
