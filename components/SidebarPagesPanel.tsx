"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type DragEvent,
} from "react";
import { normalizePageIconColorId, pageIconTextClass } from "@/lib/page-icon-colors";

type PageNavItem = {
  id: string;
  title: string | null;
  icon_type: "emoji" | "material" | string;
  icon_value: string | null;
  icon_color: string | null;
  position?: number;
  updated_at?: string;
};

type Layout = "desktop" | "mobile";

export function SidebarPagesPanel({
  layout,
  onPageLinkClick,
}: {
  layout: Layout;
  onPageLinkClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pages, setPages] = useState<PageNavItem[]>([]);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [favoritePages, setFavoritePages] = useState<PageNavItem[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);
  const pagesRef = useRef<PageNavItem[]>([]);
  const favoriteOverrideRef = useRef<Record<string, { favorited: boolean; untilMs: number }>>({});

  const isDesktop = layout === "desktop";

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/pages")
      .then(async (r) => {
        const text = await r.text().catch(() => "");
        let json: Record<string, unknown> = {};
        try {
          json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          json = {};
        }
        if (!r.ok) {
          const msg =
            typeof json.error === "string"
              ? json.error
              : text
                ? text.slice(0, 200)
                : `Failed to load pages (${r.status})`;
          throw new Error(msg);
        }
        return json;
      })
      .then((d) => {
        if (cancelled) return;
        setPagesError(null);
        setPages(Array.isArray(d.pages) ? (d.pages as PageNavItem[]) : []);
        setPagesLoaded(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setPagesError(e instanceof Error ? e.message : "Failed to load pages");
        setPagesLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  const loadFavorites = useCallback(() => {
    fetch("/api/pages/favorites")
      .then(async (r) => {
        const text = await r.text().catch(() => "");
        let json: Record<string, unknown> = {};
        try {
          json = text ? (JSON.parse(text) as Record<string, unknown>) : {};
        } catch {
          json = {};
        }
        if (!r.ok) {
          const msg =
            typeof json.error === "string"
              ? json.error
              : text
                ? text.slice(0, 200)
                : `Failed to load favorites (${r.status})`;
          throw new Error(msg);
        }
        return json;
      })
      .then((d) => {
        setFavoritesError(null);
        const serverList = Array.isArray(d.pages) ? (d.pages as PageNavItem[]) : [];
        const now = Date.now();
        const overrides = favoriteOverrideRef.current;
        for (const [id, o] of Object.entries(overrides)) {
          if (!o || now >= o.untilMs) delete overrides[id];
        }
        const activeOverrides = favoriteOverrideRef.current;
        if (Object.keys(activeOverrides).length === 0) {
          setFavoritePages(serverList);
          setFavoritesLoaded(true);
          return;
        }
        const byId = new Map(serverList.map((p) => [p.id, p]));
        for (const [pageId, o] of Object.entries(activeOverrides)) {
          if (o.favorited) {
            if (!byId.has(pageId)) {
              const fromPages = pagesRef.current.find((p) => p.id === pageId);
              if (fromPages) byId.set(pageId, fromPages);
            }
          } else {
            byId.delete(pageId);
          }
        }
        const ordered: PageNavItem[] = [];
        const used = new Set<string>();
        for (const p of serverList) {
          const row = byId.get(p.id);
          if (row) {
            ordered.push(row);
            used.add(row.id);
          }
        }
        for (const [pageId, o] of Object.entries(activeOverrides)) {
          if (!o.favorited) continue;
          if (used.has(pageId)) continue;
          const row = byId.get(pageId);
          if (row) ordered.unshift(row);
        }
        setFavoritePages(ordered);
        setFavoritesLoaded(true);
      })
      .catch((e: unknown) => {
        setFavoritesError(e instanceof Error ? e.message : "Failed to load favorites");
        setFavoritesLoaded(true);
      });
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    function onPagesChanged() {
      loadFavorites();
      void (async () => {
        try {
          const r = await fetch("/api/pages");
          const d = await r.json().catch(() => ({}));
          if (r.ok && Array.isArray(d.pages)) setPages(d.pages);
        } catch {
          /* ignore */
        }
      })();
    }
    window.addEventListener("pages-changed", onPagesChanged);
    return () => window.removeEventListener("pages-changed", onPagesChanged);
  }, [loadFavorites]);

  useEffect(() => {
    function onFavoriteChanged(e: Event) {
      const d = (e as CustomEvent<{ pageId?: string; favorited?: boolean }>).detail;
      const pageId = typeof d?.pageId === "string" ? d.pageId : "";
      const favorited = typeof d?.favorited === "boolean" ? d.favorited : null;

      if (pageId && favorited != null) {
        favoriteOverrideRef.current[pageId] = { favorited, untilMs: Date.now() + 2000 };
        setFavoritePages((prev) => {
          if (favorited) {
            if (prev.some((p) => p.id === pageId)) return prev;
            const fromPages = pagesRef.current.find((p) => p.id === pageId);
            if (!fromPages) return prev;
            return [fromPages, ...prev];
          }
          return prev.filter((p) => p.id !== pageId);
        });
        setFavoritesLoaded(true);
      }

      loadFavorites();
    }
    window.addEventListener("page-favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("page-favorite-changed", onFavoriteChanged);
  }, [loadFavorites]);

  useEffect(() => {
    function onPageMeta(e: Event) {
      const d = (e as CustomEvent<{
        pageId: string;
        title?: string | null;
        icon_type?: string;
        icon_value?: string | null;
        icon_color?: string | null;
      }>).detail;
      if (!d?.pageId) return;
      const patch = (p: PageNavItem) => {
        if (p.id !== d.pageId) return p;
        return {
          ...p,
          ...(d.title !== undefined ? { title: d.title } : {}),
          ...(d.icon_type !== undefined ? { icon_type: d.icon_type } : {}),
          ...(d.icon_value !== undefined ? { icon_value: d.icon_value } : {}),
          ...(d.icon_color !== undefined ? { icon_color: d.icon_color } : {}),
        };
      };
      setPages((prev) => prev.map(patch));
      setFavoritePages((prev) => prev.map(patch));
    }
    window.addEventListener("page-meta-updated", onPageMeta);
    return () => window.removeEventListener("page-meta-updated", onPageMeta);
  }, []);

  const pageLinkClass = (active: boolean) => {
    if (isDesktop) {
      return `flex items-center gap-2 ml-5 mr-2 rounded-md pl-3 pr-2 py-1.5 text-[13px] font-medium transition-colors ${
        active
          ? "text-mono-dark bg-mono-dark/[0.06]"
          : "text-mono-medium hover:text-mono-dark hover:bg-mono-dark/[0.04]"
      }`;
    }
    return `flex items-center gap-3 mx-2 rounded-lg px-3 py-2.5 text-[15px] font-medium transition-colors touch-manipulation ${
      active
        ? "text-mono-dark bg-mono-dark/[0.06]"
        : "text-mono-medium hover:text-mono-dark hover:bg-mono-dark/[0.04]"
    }`;
  };

  const pageNavLink = (p: PageNavItem) => {
    const href = `/pages/${p.id}`;
    const active = isActive(href);
    const iconValue =
      typeof p.icon_value === "string" && p.icon_value.length > 0
        ? p.icon_value
        : p.icon_type === "material"
          ? "description"
          : "📄";
    const label = (typeof p.title === "string" ? p.title : "").trim() || "Untitled";
    const isMaterial = p.icon_type === "material";
    const iconSize = isDesktop ? 18 : 20;
    return (
      <Link
        key={p.id}
        href={href}
        onClick={() => {
          if (layout === "mobile" && onPageLinkClick) onPageLinkClick();
        }}
        className={pageLinkClass(active)}
      >
        <span
          className={`shrink-0 flex h-5 w-5 items-center justify-start ${pageIconTextClass(
            normalizePageIconColorId(p.icon_color),
          )}`}
        >
          {isMaterial ? (
            <span
              className="material-symbols-rounded leading-none"
              style={{
                fontSize: iconSize,
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
              }}
            >
              {iconValue}
            </span>
          ) : (
            <span className="leading-none text-[15px]">{iconValue}</span>
          )}
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
      </Link>
    );
  };

  const [dragPageId, setDragPageId] = useState<string | null>(null);
  const [dropAtIndex, setDropAtIndex] = useState<number | null>(null);
  const dropAtIndexRef = useRef<number | null>(null);
  const favoriteIdSet = useMemo(() => new Set(favoritePages.map((p) => p.id)), [favoritePages]);
  const reorderablePages = useMemo(() => pages.filter((p) => !favoriteIdSet.has(p.id)), [pages, favoriteIdSet]);
  const reorderableIndexById = useMemo(() => {
    const m = new Map<string, number>();
    reorderablePages.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [reorderablePages]);

  const dropLineClass = isDesktop
    ? "pointer-events-none absolute left-8 right-3 top-0 h-[2px] -translate-y-1/2 rounded-full bg-[#007aff]"
    : "pointer-events-none absolute left-2 right-2 top-0 h-[2px] -translate-y-1/2 rounded-full bg-[#007aff]";
  const dropLineEndClass = isDesktop
    ? "pointer-events-none absolute left-8 right-3 bottom-0 h-[2px] translate-y-1/2 rounded-full bg-[#007aff]"
    : "pointer-events-none absolute left-2 right-2 bottom-0 h-[2px] translate-y-1/2 rounded-full bg-[#007aff]";

  const onPageDragStart = useCallback(
    (e: DragEvent, pageId: string) => {
      if (favoriteIdSet.has(pageId)) return;
      setDragPageId(pageId);
      setDropAtIndex(null);
      dropAtIndexRef.current = null;
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", pageId);
    },
    [favoriteIdSet],
  );

  const onPageDragOver = useCallback(
    (e: DragEvent, overPageId: string) => {
      if (!dragPageId) return;
      if (favoriteIdSet.has(overPageId)) return;
      const overIndex = reorderableIndexById.get(overPageId);
      if (overIndex == null) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      const at = before ? overIndex : overIndex + 1;
      setDropAtIndex(at);
      dropAtIndexRef.current = at;
    },
    [dragPageId, favoriteIdSet, reorderableIndexById],
  );

  const onPageDrop = useCallback(
    async (e: DragEvent) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      const at = dropAtIndexRef.current;
      setDragPageId(null);
      setDropAtIndex(null);
      dropAtIndexRef.current = null;
      if (!sourceId || at == null) return;
      if (favoriteIdSet.has(sourceId)) return;

      const list = reorderablePages;
      const fromIdx = list.findIndex((p) => p.id === sourceId);
      if (fromIdx === -1) return;
      let toIdx = at;
      const next = [...list];
      const [moved] = next.splice(fromIdx, 1);
      if (!moved) return;
      if (fromIdx < toIdx) toIdx -= 1;
      toIdx = Math.max(0, Math.min(next.length, toIdx));
      next.splice(toIdx, 0, moved);

      setPages((prev) => {
        const fav = prev.filter((p) => favoriteIdSet.has(p.id));
        const rest = prev.filter((p) => !favoriteIdSet.has(p.id));
        const restById = new Map(rest.map((p) => [p.id, p]));
        const orderedRest = next.map((p) => restById.get(p.id) ?? p);
        return [...fav, ...orderedRest];
      });

      try {
        const res = await fetch("/api/pages/reorder", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ page_ids: next.map((p) => p.id) }),
        });
        if (!res.ok) throw new Error("Failed");
        window.dispatchEvent(new CustomEvent("pages-changed"));
      } catch {
        try {
          const r = await fetch("/api/pages");
          const d = await r.json().catch(() => ({}));
          if (r.ok && Array.isArray(d.pages)) setPages(d.pages);
        } catch {
          /* ignore */
        }
      }
    },
    [favoriteIdSet, reorderablePages],
  );

  const onPageDragEnd = useCallback(() => {
    setDragPageId(null);
    setDropAtIndex(null);
    dropAtIndexRef.current = null;
  }, []);

  const createPage = async () => {
    if (creatingPage) return;
    setCreatingPage(true);
    try {
      setPagesError(null);
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const text = await res.text().catch(() => "");
      let data: Record<string, unknown> = {};
      try {
        data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
      } catch {
        data = {};
      }
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : text
              ? text.slice(0, 200)
              : `Failed to create page (${res.status})`;
        setPagesError(msg);
        return;
      }
      const created = data.page;
      if (created && typeof created === "object" && created !== null && "id" in created) {
        const pageRow = created as PageNavItem;
        if (pageRow.id) {
          const nextPages = [pageRow, ...pages];
          setPages(nextPages);
          window.dispatchEvent(new CustomEvent("pages-changed"));
          router.push(`/pages/${pageRow.id}`);
        }
      }
    } finally {
      setCreatingPage(false);
    }
  };

  const favHeaderClass = isDesktop ? "pl-8 pr-3 mb-2" : "px-4 mb-2";
  const pagesHeaderClass = isDesktop ? "pl-8 pr-3 mb-2" : "px-4 mb-2";
  const errPad = isDesktop ? "pl-8 pr-3" : "px-4";

  return (
    <>
      {favoritesLoaded && (favoritePages.length > 0 || favoritesError) && (
        <div className={isDesktop ? "mt-6" : "mt-2"}>
          <div className={favHeaderClass}>
            <div className="text-[11px] font-semibold tracking-wide text-mono-light uppercase">
              Favorites
            </div>
          </div>
          <div className={`space-y-0.5 ${isDesktop ? "mb-4" : "mb-3"}`}>
            {favoritesError && (
              <div className={`${errPad} py-2 text-[13px] text-red-600`}>{favoritesError}</div>
            )}
            {favoritePages.map(pageNavLink)}
          </div>
        </div>
      )}

      <div className={isDesktop ? "mt-2" : ""}>
        <div className={`${pagesHeaderClass} flex items-center justify-between`}>
          <div className="text-[11px] font-semibold tracking-wide text-mono-light uppercase">
            Pages
          </div>
          <button
            type="button"
            onClick={createPage}
            disabled={creatingPage}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-mono-light transition hover:bg-black/[0.04] hover:text-mono-medium active:scale-[0.98] disabled:opacity-50 touch-manipulation"
            aria-label="Add page"
            title="Add page"
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: isDesktop ? 18 : 20,
                fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
              }}
            >
              add
            </span>
          </button>
        </div>

        <div className="space-y-0.5">
          {pagesError && (
            <div className={`${errPad} py-2 text-[13px] text-red-600`}>{pagesError}</div>
          )}
          {!pagesLoaded ? (
            <div className={`${errPad} py-2 text-[13px] text-mono-light`}>Loading…</div>
          ) : pages.length === 0 ? (
            <div className={`${errPad} py-2 text-[13px] text-mono-light`}>No pages yet</div>
          ) : (
            <div onDragOver={(e) => e.preventDefault()} onDrop={onPageDrop}>
              {pages.map((p) => {
                const isFav = favoriteIdSet.has(p.id);
                const idx = reorderableIndexById.get(p.id) ?? -1;
                const showLineAbove = !isFav && dragPageId && dropAtIndex === idx;
                const showLineEnd =
                  !isFav &&
                  dragPageId &&
                  dropAtIndex === reorderablePages.length &&
                  idx === reorderablePages.length - 1;
                return (
                  <div
                    key={p.id}
                    draggable={!isFav}
                    onDragStart={(e) => onPageDragStart(e, p.id)}
                    onDragOver={(e) => onPageDragOver(e, p.id)}
                    onDragEnd={onPageDragEnd}
                    className={`relative ${isFav ? "" : "cursor-grab active:cursor-grabbing"}`}
                  >
                    {showLineAbove ? <div className={dropLineClass} /> : null}
                    {pageNavLink(p)}
                    {showLineEnd ? <div className={dropLineEndClass} /> : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
