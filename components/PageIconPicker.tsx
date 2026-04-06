"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import materialSymbolNames from "@/lib/material-symbol-names.json";
import {
  normalizePageIconColorId,
  pageIconSwatchFillClass,
  pageIconTextClass,
  pageIconTriggerClass,
  PAGE_ICON_COLOR_IDS,
} from "@/lib/page-icon-colors";
import { materialIconSearchBlob } from "@/lib/material-icon-tags";
import emojiEnDefault from "emoji-picker-react/dist/data/emojis-en.js";

export type PageIconType = "emoji" | "material";

export type PageIconValue = {
  icon_type: PageIconType;
  icon_value: string;
  icon_color: string;
};

/** All Material Symbols Rounded names from Google Fonts metadata (3,848). */
const MATERIAL_ICON_NAMES: readonly string[] = materialSymbolNames;

/** Matches `h-9` + `gap-0.5` in the picker grid. */
const PICKER_GRID_COLS = 6;
const PICKER_CELL_PX = 36;
const PICKER_GAP_PX = 2;
const PICKER_ROW_STRIDE = PICKER_CELL_PX + PICKER_GAP_PX;
const PICKER_OVERSCAN_ROWS = 6;

function PickerVirtualGrid<T>({
  items,
  className,
  resetDeps,
  renderItem,
}: {
  items: readonly T[];
  className?: string;
  resetDeps: unknown;
  renderItem: (item: T, index: number) => ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [, setScrollTick] = useState(0);
  const bump = useCallback(() => setScrollTick((n) => n + 1), []);

  useEffect(() => {
    const el = outerRef.current;
    if (el) el.scrollTop = 0;
  }, [resetDeps]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    bump();
    el.addEventListener("scroll", bump, { passive: true });
    const ro = new ResizeObserver(bump);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", bump);
      ro.disconnect();
    };
  }, [bump]);

  const el = outerRef.current;
  const scrollTop = el?.scrollTop ?? 0;
  const viewportH = el?.clientHeight ?? 320;

  const n = items.length;
  if (n === 0) {
    return <div ref={outerRef} className={className} />;
  }

  const totalRows = Math.ceil(n / PICKER_GRID_COLS);
  const totalHeight = totalRows * PICKER_ROW_STRIDE - PICKER_GAP_PX;

  let startRow = Math.floor(scrollTop / PICKER_ROW_STRIDE) - PICKER_OVERSCAN_ROWS;
  let endRow = Math.ceil((scrollTop + viewportH) / PICKER_ROW_STRIDE) + PICKER_OVERSCAN_ROWS;
  if (startRow < 0) startRow = 0;
  if (endRow > totalRows) endRow = totalRows;

  const startIdx = startRow * PICKER_GRID_COLS;
  const endIdx = Math.min(n, endRow * PICKER_GRID_COLS);

  return (
    <div ref={outerRef} className={className}>
      <div className="relative w-full" style={{ height: totalHeight }}>
        <div
          className="absolute left-0 right-0"
          style={{ transform: `translateY(${startRow * PICKER_ROW_STRIDE}px)` }}
        >
          <div className="grid grid-cols-6 gap-0.5">
            {items.slice(startIdx, endIdx).map((item, j) => renderItem(item, startIdx + j))}
          </div>
        </div>
      </div>
    </div>
  );
}

type RawEmoji = { n: string[]; u: string; a?: string };

type EmojiCatalogEntry = {
  char: string;
  label: string;
  tags: string[];
  searchBlob: string;
};

function unicodeToChar(u: string): string {
  try {
    const codes = u.split("-").map((hex) => parseInt(hex, 16));
    return String.fromCodePoint(...codes);
  } catch {
    return "";
  }
}

function emojiLabelAndTags(n: string[]): { label: string; tags: string[] } {
  const label = n[n.length - 1] || n[0] || "emoji";
  const rest = n.filter((s) => s !== label);
  const tags = rest.slice(0, 3);
  let i = 0;
  while (tags.length < 3 && i < n.length) {
    const t = n[i];
    if (t && !tags.includes(t)) tags.push(t);
    i++;
  }
  while (tags.length < 3) tags.push(label);
  return { label, tags: tags.slice(0, 3) };
}

function buildEmojiCatalog(): EmojiCatalogEntry[] {
  const data = (emojiEnDefault as { default?: { emojis: Record<string, RawEmoji[] | unknown> }; emojis?: Record<string, RawEmoji[] | unknown> })
    .default ?? emojiEnDefault;
  const emojis = data.emojis as Record<string, RawEmoji[] | unknown>;
  const seen = new Set<string>();
  const rows: EmojiCatalogEntry[] = [];

  for (const list of Object.values(emojis)) {
    if (!Array.isArray(list)) continue;
    for (const item of list as RawEmoji[]) {
      if (!item?.u || !Array.isArray(item.n)) continue;
      const char = unicodeToChar(item.u);
      if (!char || seen.has(char)) continue;
      seen.add(char);
      const { label, tags } = emojiLabelAndTags(item.n);
      const searchBlob = [label, ...tags, ...item.n].join(" ").toLowerCase();
      rows.push({ char, label, tags, searchBlob });
    }
  }
  return rows;
}

export function PageIconPicker({
  value,
  onChange,
  size = 20,
  variant = "default",
  className,
}: {
  value: PageIconValue;
  onChange: (next: PageIconValue) => void;
  size?: number;
  variant?: "default" | "plain";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"emoji" | "icons">(
    value.icon_type === "material" ? "icons" : "emoji"
  );
  const [iconSearch, setIconSearch] = useState("");
  const [emojiSearch, setEmojiSearch] = useState("");
  const panelRef = useRef<HTMLDivElement | null>(null);

  const emojiCatalog = useMemo(() => buildEmojiCatalog(), []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!open) return;
      const el = panelRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  const normalizedColor = normalizePageIconColorId(value.icon_color);

  const { iconVisible, iconMatchCount } = useMemo(() => {
    const q = iconSearch.trim().toLowerCase();
    const scoreName = (name: string) => {
      if (!q) return true;
      if (name.toLowerCase().includes(q)) return true;
      return materialIconSearchBlob(name).includes(q);
    };

    if (!q) {
      return {
        iconVisible: MATERIAL_ICON_NAMES,
        iconMatchCount: null as number | null,
      };
    }
    const matches = MATERIAL_ICON_NAMES.filter(scoreName);
    return {
      iconVisible: matches,
      iconMatchCount: matches.length,
    };
  }, [iconSearch]);

  const { emojiVisible, emojiMatchCount } = useMemo(() => {
    const q = emojiSearch.trim().toLowerCase();
    if (!q) {
      return {
        emojiVisible: emojiCatalog,
        emojiMatchCount: null as number | null,
      };
    }
    const matches = emojiCatalog.filter((e) => e.searchBlob.includes(q));
    return {
      emojiVisible: matches,
      emojiMatchCount: matches.length,
    };
  }, [emojiSearch, emojiCatalog]);

  const plainClass = pageIconTextClass(value.icon_color);
  const pickerGlyphClass = pageIconTextClass(value.icon_color);
  const triggerClass =
    variant === "plain"
      ? `inline-flex items-center justify-start rounded-none border-0 bg-transparent p-0 ${plainClass} hover:bg-bg-tertiary/25 transition-colors`
      : `inline-flex items-center justify-center rounded-none ${pageIconTriggerClass(value.icon_color)}`;

  return (
    <div className={`relative${className ? ` ${className}` : ""}`} ref={panelRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className={triggerClass}
        style={
          variant === "plain"
            ? { minHeight: size }
            : { width: size, height: size }
        }
        aria-label="Change page icon"
        title="Change page icon"
      >
        {value.icon_type === "material" ? (
          <span
            className="material-symbols-rounded leading-none"
            style={{
              fontSize: Math.max(14, size - 4),
              fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
            }}
          >
            {value.icon_value}
          </span>
        ) : (
          <span className="leading-none" style={{ fontSize: Math.max(14, size - 4) }}>
            {value.icon_value}
          </span>
        )}
      </button>

      {open && (
        <div
          className="page-icon-picker-panel absolute left-0 top-[calc(100%+8px)] z-[100] w-[260px] max-w-[260px] rounded-none border border-bg-tertiary/60 bg-white shadow-lg flex min-h-0 flex-col overflow-hidden max-h-[min(70vh,420px)]"
        >
          <div className="px-2 pt-2 pb-1.5 flex flex-wrap items-center gap-1.5 shrink-0 border-b border-bg-tertiary/40">
            <button
              type="button"
              onClick={() => setTab("emoji")}
              className={`text-[12px] font-semibold px-2 py-1 rounded-none ${
                tab === "emoji"
                  ? "bg-sovereign-blue/10 text-sovereign-blue"
                  : "text-mono-medium hover:bg-sovereign-blue/10"
              }`}
            >
              Emoji
            </button>
            <button
              type="button"
              onClick={() => setTab("icons")}
              className={`text-[12px] font-semibold px-2 py-1 rounded-none ${
                tab === "icons"
                  ? "bg-sovereign-blue/10 text-sovereign-blue"
                  : "text-mono-medium hover:bg-sovereign-blue/10"
              }`}
            >
              Icons
            </button>
          </div>

          {tab === "emoji" ? (
            <>
              <div className="border-b border-bg-tertiary/50 shrink-0 min-h-[40px]">
                <input
                  type="search"
                  value={emojiSearch}
                  onChange={(e) => setEmojiSearch(e.target.value)}
                  placeholder="Search…"
                  className="page-icon-picker-search w-full min-w-0 box-border rounded-none border-0 bg-white pl-2 py-2 text-[13px] text-mono-dark ring-0 ring-offset-0 placeholder:text-mono-light"
                  aria-label="Search emojis"
                />
              </div>
              {emojiSearch.trim() && emojiMatchCount === 0 ? (
                <div className="min-h-0 max-h-[min(300px,calc(70vh-7rem))] flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1 flex items-center justify-center">
                  <div className="py-3 text-[12px] text-mono-light text-center">No emojis found</div>
                </div>
              ) : (
                <PickerVirtualGrid
                  items={emojiVisible}
                  resetDeps={emojiSearch}
                  className="min-h-0 max-h-[min(300px,calc(70vh-7rem))] flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 pb-2 pt-1 [-webkit-overflow-scrolling:touch]"
                  renderItem={(e, i) => (
                    <button
                      key={`emoji-${i}`}
                      type="button"
                      onClick={() => {
                        onChange({
                          icon_type: "emoji",
                          icon_value: e.char,
                          icon_color: value.icon_color,
                        });
                        setOpen(false);
                      }}
                      className={`flex h-9 w-9 items-center justify-center rounded-none border border-bg-tertiary/50 text-lg leading-none hover:bg-sovereign-blue/10 transition-colors ${pickerGlyphClass}`}
                      title={e.label}
                      aria-label={e.label}
                    >
                      {e.char}
                    </button>
                  )}
                />
              )}
            </>
          ) : (
            <>
              <div className="border-b border-bg-tertiary/50 shrink-0 min-h-[40px]">
                <input
                  type="search"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Search…"
                  className="page-icon-picker-search w-full min-w-0 box-border rounded-none border-0 bg-white pl-2 py-2 text-[13px] text-mono-dark ring-0 ring-offset-0 placeholder:text-mono-light"
                  aria-label="Search Material Symbols"
                />
              </div>
              {iconSearch.trim() && iconMatchCount === 0 ? (
                <div className="min-h-0 max-h-[min(300px,calc(70vh-7rem))] flex-1 overflow-y-auto overflow-x-hidden px-2 pb-2 pt-1 flex items-center justify-center">
                  <div className="py-3 text-[12px] text-mono-light text-center">No icons found</div>
                </div>
              ) : (
                <PickerVirtualGrid
                  items={iconVisible}
                  resetDeps={iconSearch}
                  className="min-h-0 max-h-[min(300px,calc(70vh-7rem))] flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-2 pb-2 pt-1 [-webkit-overflow-scrolling:touch]"
                  renderItem={(name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onChange({
                          icon_type: "material",
                          icon_value: name,
                          icon_color: value.icon_color,
                        });
                        setOpen(false);
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-none border border-bg-tertiary/50 hover:bg-sovereign-blue/10 transition-colors"
                      title={name.replace(/_/g, " ")}
                      aria-label={name.replace(/_/g, " ")}
                    >
                      <span
                        className={`material-symbols-rounded leading-none ${pickerGlyphClass}`}
                        style={{
                          fontSize: 18,
                          fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                        }}
                      >
                        {name}
                      </span>
                    </button>
                  )}
                />
              )}
            </>
          )}

          {tab === "icons" && (
            <div
              className="shrink-0 border-t border-stone-200/90 bg-stone-100/60 px-2.5 py-2"
              role="group"
              aria-label="Icon color"
            >
              <p className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-500">
                Color
              </p>
              <div className="flex w-full flex-wrap items-center justify-start gap-x-1 gap-y-1">
                {PAGE_ICON_COLOR_IDS.map((id) => {
                  const selected = normalizedColor === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => onChange({ ...value, icon_color: id })}
                      className={`h-5 w-5 shrink-0 rounded-full border border-black/[0.08] shadow-[0_1px_2px_rgba(0,0,0,0.06)] transition-transform ${pageIconSwatchFillClass(id)} ${
                        selected
                          ? "ring-2 ring-zinc-900/35 ring-offset-2 ring-offset-stone-100 scale-105"
                          : "hover:scale-105"
                      }`}
                      aria-label={`Color ${id}`}
                      aria-pressed={selected}
                      title={id}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
