"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { getStickyTaxYearClient } from "@/lib/tax-year-cookie";

type TxRow = {
  id: string;
  date: string;
  vendor: string;
  display_name: string | null;
  amount: string;
  category: string | null;
  status: string;
};

type CommandPaletteApi = {
  open: () => void;
  close: () => void;
  toggle: () => void;
};

const CommandPaletteContext = createContext<CommandPaletteApi | null>(null);

type WorkspaceRow = { id: string; name: string };
function getWorkspaceCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)et_workspace=([^;]+)/);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1] ?? "").trim() || null;
  } catch {
    return (m[1] ?? "").trim() || null;
  }
}
function setWorkspaceCookie(id: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `et_workspace=${encodeURIComponent(id)}; path=/; max-age=${maxAge}`;
}

export function useCommandPalette(): CommandPaletteApi {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) {
    throw new Error("useCommandPalette must be used within CommandPaletteProvider");
  }
  return ctx;
}

function CommandPaletteModal({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TxRow[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceRow[]>([]);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const taxYear = getStickyTaxYearClient();

  useEffect(() => {
    const initial = getWorkspaceCookie();
    if (initial) setWorkspaceId(initial);
    let alive = true;
    (async () => {
      const res = await fetch("/api/workspaces");
      const json = await res.json().catch(() => ({}));
      const list = Array.isArray(json.data) ? (json.data as any[]) : [];
      const mapped = list.map((w) => ({ id: String(w.id), name: String(w.name) }));
      if (!alive) return;
      setWorkspaces(mapped);
      if (!initial && mapped[0]?.id) {
        setWorkspaceId(mapped[0].id);
        setWorkspaceCookie(mapped[0].id);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const runSearch = useCallback(
    async (query: string) => {
      const term = query.trim();
      if (term.length < 1) {
        setResults([]);
        return;
      }
      setLoading(true);
      try {
        const params = new URLSearchParams({
          tax_year: String(taxYear),
          limit: "25",
          search: term,
          sort_by: "date",
          sort_order: "desc",
        });
        const res = await fetch(`/api/transactions?${params.toString()}`, {
          headers: workspaceId ? { "x-workspace-id": workspaceId } : undefined,
        });
        const data = await res.json().catch(() => ({}));
        setResults(Array.isArray(data.data) ? data.data : []);
      } finally {
        setLoading(false);
      }
    },
    [taxYear, workspaceId]
  );

  useEffect(() => {
    const t = window.setTimeout(() => runSearch(q), 200);
    return () => window.clearTimeout(t);
  }, [q, runSearch]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Search transactions"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-2xl bg-white/95 shadow-xl border border-white/60 ring-1 ring-black/5 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-3 py-3 border-b border-[#F0F1F7]">
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-2 rounded-lg bg-sovereign-blue text-white px-2 text-[10px] font-bold"
              onClick={() => {
                // cycle workspace quickly if multiple exist
                if (workspaces.length <= 1) return;
                const idx = workspaces.findIndex((w) => w.id === workspaceId);
                const next = workspaces[(idx + 1) % workspaces.length]!;
                setWorkspaceId(next.id);
                setWorkspaceCookie(next.id);
              }}
              title="Switch workspace"
            >
              XT
              <span className="material-symbols-rounded text-white/90 text-sm">expand_more</span>
            </button>
          </div>
          <input
            autoFocus
            className="flex-1 min-w-0 bg-transparent text-[15px] text-mono-dark placeholder:text-mono-light outline-none"
            placeholder="Search transactions in Expense Terminal…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button
            type="button"
            className="shrink-0 h-9 w-9 rounded-full bg-sovereign-blue text-white flex items-center justify-center"
            aria-label="Filters"
          >
            <span className="material-symbols-rounded text-[18px]">filter_list</span>
          </button>
        </div>

        <div className="px-3 py-2 flex flex-wrap gap-2 border-b border-[#F0F1F7] bg-[#fafafa]">
          <span className="text-[11px] text-mono-medium px-2 py-1 rounded-md bg-white border border-[#eee]">
            Aa All fields
          </span>
          {workspaces.length > 0 && (
            <span className="text-[11px] text-mono-medium px-2 py-1 rounded-md bg-white border border-[#eee]">
              Workspace: {workspaces.find((w) => w.id === workspaceId)?.name ?? "—"}
            </span>
          )}
          <span className="text-[11px] text-mono-medium px-2 py-1 rounded-md bg-white border border-[#eee]">
            Status: any
          </span>
          <span className="text-[11px] text-mono-medium px-2 py-1 rounded-md bg-white border border-[#eee]">
            Year: {taxYear}
          </span>
        </div>

        <div className="max-h-[320px] overflow-y-auto min-h-[120px]">
          {loading && <p className="p-6 text-sm text-mono-medium">Searching…</p>}
          {!loading && q.trim().length < 1 && (
            <p className="p-6 text-sm text-mono-light">Type to search by merchant, description, or category.</p>
          )}
          {!loading && q.trim().length >= 1 && results.length === 0 && (
            <p className="p-6 text-sm text-mono-light">No matches.</p>
          )}
          <ul className="py-1">
            {results.map((row) => (
              <li key={row.id}>
                <Link
                  href={`/activity?focus=${row.id}`}
                  className="flex gap-3 px-4 py-2.5 hover:bg-[#f5f5f7] transition-colors"
                  onClick={onClose}
                >
                  <span className="material-symbols-rounded text-mono-light text-xl mt-0.5">receipt</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-mono-dark truncate">
                      {row.display_name || row.vendor}
                    </p>
                    <p className="text-xs text-mono-light truncate">
                      {row.date}
                      {row.category ? ` · ${row.category}` : ""} · {row.status}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-mono-dark shrink-0">
                    ${Number(row.amount).toFixed(2)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-2 border-t border-[#F0F1F7] flex flex-wrap items-center justify-between gap-2 text-[11px] text-mono-light">
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[#f0f0f0]">↵</kbd> open
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[#f0f0f0]">esc</kbd> close
          </span>
          <span>
            <kbd className="px-1 py-0.5 rounded bg-[#f0f0f0]">⌘K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}

/** Wraps authenticated app chrome so ⌘K and search triggers work on desktop and mobile. */
export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const value: CommandPaletteApi = { open: openModal, close: closeModal, toggle };

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      {open ? <CommandPaletteModal onClose={closeModal} /> : null}
    </CommandPaletteContext.Provider>
  );
}

/** Desktop sidebar search row (Notion-style). */
export function CommandPaletteSidebarTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="w-full flex items-center gap-2 rounded-xl border border-[#F0F1F7] bg-[#fafafa] px-3 py-2 text-left text-[13px] text-mono-light hover:border-sovereign-blue/30 transition-colors mb-3"
    >
      <span className="material-symbols-rounded text-lg">search</span>
      <span className="flex-1">Search transactions…</span>
      <kbd className="hidden sm:inline text-[10px] px-1.5 py-0.5 rounded bg-white border border-[#eee]">⌘K</kbd>
    </button>
  );
}

/** Mobile footer — opens same palette as sidebar. */
export function CommandPaletteMobileTrigger() {
  const { open } = useCommandPalette();
  return (
    <button
      type="button"
      onClick={open}
      className="flex flex-col items-center justify-center gap-0.5 min-w-[56px] py-2 rounded-lg text-mono-medium transition-colors duration-200 active:text-mono-dark"
      aria-label="Search transactions"
    >
      <span className="material-symbols-rounded text-[22px] leading-none">search</span>
      <span className="text-[10px] font-medium tracking-tight">Search</span>
    </button>
  );
}
