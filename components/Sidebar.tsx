"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import { normalizePageIconColorId, pageIconTextClass } from "@/lib/page-icon-colors";

type PageNavItem = {
  id: string;
  title: string | null;
  icon_type: "emoji" | "material" | string;
  icon_value: string | null;
  icon_color: string | null;
  updated_at?: string;
};

const mainNav = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/data-sources", label: "Accounts & Data", icon: "database" },
  { href: "/inbox", label: "Inbox", icon: "visibility" },
  { href: "/other-deductions", label: "Other Deductions", icon: "receipt_long" },
];

const bottomNav = [{ href: "/preferences/automations", label: "Preferences", icon: "tune" }];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [inboxCount, setInboxCount] = useState<number | null>(null);
  const [pages, setPages] = useState<PageNavItem[]>([]);
  const [pagesLoaded, setPagesLoaded] = useState(false);
  const [creatingPage, setCreatingPage] = useState(false);
  const [pagesError, setPagesError] = useState<string | null>(null);
  const [favoritePages, setFavoritePages] = useState<PageNavItem[]>([]);
  const [favoritesLoaded, setFavoritesLoaded] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const loadInboxCount = () => {
    // Count pending across all tax years so sync'd transactions show up regardless of date
    fetch(`/api/transactions?status=pending&count_only=true`)
      .then((r) => r.json())
      .then((d) => setInboxCount(d.count ?? 0))
      .catch(() => {});
  };

  useEffect(() => {
    loadInboxCount();
  }, [pathname]);

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
        setFavoritePages(Array.isArray(d.pages) ? (d.pages as PageNavItem[]) : []);
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
    function onFavoriteChanged() {
      loadFavorites();
    }
    window.addEventListener("page-favorite-changed", onFavoriteChanged);
    return () => window.removeEventListener("page-favorite-changed", onFavoriteChanged);
  }, [loadFavorites]);

  useEffect(() => {
    function handleInboxChanged() {
      loadInboxCount();
    }
    window.addEventListener("inbox-count-changed", handleInboxChanged);
    return () => window.removeEventListener("inbox-count-changed", handleInboxChanged);
  }, []);

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
    return (
      <Link
        key={p.id}
        href={href}
        className={`flex items-center gap-2 ml-5 mr-2 rounded-md pl-3 pr-2 py-1.5 text-[13px] font-medium transition-colors ${
          active
            ? "text-mono-dark bg-mono-dark/[0.06]"
            : "text-mono-medium hover:text-mono-dark hover:bg-mono-dark/[0.04]"
        }`}
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
                fontSize: 18,
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

  return (
    <aside className="sticky top-0 h-screen w-[260px] shrink-0 bg-white flex flex-col border-r border-bg-tertiary/60">
      {/* Small XT logo header */}
      <div className="pl-8 pr-5 pt-6 pb-4">
        <Link href="/" className="inline-flex items-center">
          <Image
            src="/xt-logo-v2.png"
            alt="XT"
            width={80}
            height={32}
            className="h-8 w-auto object-contain"
            priority={false}
          />
        </Link>
      </div>

      {/* Main nav - block extends to left edge; content stays aligned (pl-8 = 5+3) */}
      <nav className="flex-1 pl-0 pr-5">
        <div className="space-y-1">
          {mainNav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 ml-5 mr-2 rounded-md pl-3 pr-2 py-2 text-[13px] font-medium transition-colors ${
                isActive(item.href)
                  ? "text-mono-dark bg-mono-dark/[0.06]"
                  : "text-mono-medium hover:text-mono-dark hover:bg-mono-dark/[0.04]"
              }`}
            >
              <span
                className={`material-symbols-rounded leading-none transition-colors ${
                  isActive(item.href) ? "text-mono-dark" : ""
                }`}
                style={{
                  fontSize: 20,
                  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                }}
              >
                {item.icon}
              </span>
              <span className="flex-1">{item.label}</span>
              {item.href === "/inbox" && inboxCount != null && inboxCount > 0 && (
                <span className="bg-[#2563EB] text-white text-[11px] font-semibold rounded-none px-2 py-0.5 tabular-nums">
                  <span className="relative top-px">{inboxCount}</span>
                </span>
              )}
            </Link>
          ))}
        </div>

        {favoritesLoaded && (favoritePages.length > 0 || favoritesError) && (
          <div className="mt-6">
            <div className="pl-8 pr-3 mb-2">
              <div className="text-[11px] font-semibold tracking-wide text-mono-light uppercase">
                Favorites
              </div>
            </div>
            <div className="space-y-0.5 mb-4">
              {favoritesError && (
                <div className="pl-8 pr-3 py-2 text-[13px] text-red-600">{favoritesError}</div>
              )}
              {favoritePages.map(pageNavLink)}
            </div>
          </div>
        )}

        <div className="mt-2">
          <div className="pl-8 pr-3 mb-2 flex items-center justify-between">
            <div className="text-[11px] font-semibold tracking-wide text-mono-light uppercase">
              Pages
            </div>
            <button
              type="button"
              onClick={createPage}
              disabled={creatingPage}
              className="inline-flex items-center justify-center rounded-none h-7 w-7 text-mono-light hover:text-mono-medium hover:bg-sovereign-blue/10 transition disabled:opacity-50"
              aria-label="Add page"
              title="Add page"
            >
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: 18,
                  fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20",
                }}
              >
                add
              </span>
            </button>
          </div>

          <div className="space-y-0.5">
            {pagesError && (
              <div className="pl-8 pr-3 py-2 text-[13px] text-red-600">
                {pagesError}
              </div>
            )}
            {!pagesLoaded ? (
              <div className="pl-8 pr-3 py-2 text-[13px] text-mono-light">Loading…</div>
            ) : pages.length === 0 ? (
              <div className="pl-8 pr-3 py-2 text-[13px] text-mono-light">
                No pages yet
              </div>
            ) : (
              pages.map(pageNavLink)
            )}
          </div>
        </div>
      </nav>

      {/* Bottom nav - left align with main nav (px-5) */}
      <div className="px-5 pb-3 space-y-0.5">
        {bottomNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center py-2.5 text-base transition-all group ${
              isActive(item.href)
                ? "text-sovereign-blue font-medium"
                : "text-mono-light hover:text-mono-medium"
            }`}
          >
            {/* Line that grows 0→20px and pushes the text right */}
            <span
              className={`shrink-0 overflow-hidden flex items-center transition-all duration-500 ${
                isActive(item.href) ? "w-[20px]" : "w-0 group-hover:w-[20px]"
              }`}
            >
              <span className="h-0.5 w-[20px] rounded-full bg-sovereign-blue" />
            </span>
            <span className="ml-2">{item.label}</span>
          </Link>
        ))}
        <a
          href="mailto:expenseterminal@outlook.com"
          className="flex items-center py-2.5 text-base transition-all group text-mono-light hover:text-mono-medium"
        >
          <span className="shrink-0 overflow-hidden flex items-center transition-all duration-500 w-0 group-hover:w-[20px]">
            <span className="h-0.5 w-[20px] rounded-full bg-sovereign-blue" />
          </span>
          <span className="ml-2">Contact Our Team</span>
        </a>
      </div>

      {/* Footer - Guides and Support commented out
      <div className="px-5 pb-4 flex items-center gap-3">
        <a
          href={GUIDES_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-bg-tertiary/60 text-sm text-mono-medium hover:text-mono-dark hover:border-bg-tertiary transition-all"
        >
          <span className="material-symbols-rounded text-[12px]">menu_book</span> Guides
        </a>
        <a
          href="mailto:expenseterminal@outlook.com"
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg border border-bg-tertiary/60 text-sm text-mono-medium hover:text-mono-dark hover:border-bg-tertiary transition-all"
        >
          <span className="material-symbols-rounded text-[12px]">mail</span> Support
        </a>
      </div>
      */}
    </aside>
  );
}
