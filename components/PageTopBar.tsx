"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PageShareModal } from "@/components/PageShareModal";
import { PageMenuDrawer } from "@/components/PageMenuDrawer";

const actionTextClass =
  "inline-flex h-8 items-center rounded-none border-0 bg-transparent px-2.5 text-[13px] font-medium text-mono-dark hover:bg-bg-secondary/50 transition-colors";
const menuIconBtnClass =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-transparent text-mono-dark transition-colors hover:bg-black/[0.05] active:scale-[0.97]";

const ICON_PX = 18;

/** Material Symbols often ignore Tailwind text-* size; use inline fontSize. */
const iconGlyphStyle = (opts: { favorited?: boolean } = {}) =>
  ({
    fontSize: ICON_PX,
    lineHeight: 1,
    fontVariationSettings: opts.favorited
      ? ("'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 20" as const)
      : ("'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 20" as const),
  }) as const;

export function PageTopBar({
  pageId,
  favorited,
  fullWidth: fullWidthInitial,
  onFullWidthChange,
  onFavoritedChange,
}: {
  pageId: string;
  favorited: boolean;
  fullWidth: boolean;
  onFullWidthChange: (next: boolean) => void;
  onFavoritedChange: (favorited: boolean) => void;
}) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const toggleFavorite = useCallback(async () => {
    const next = !favorited;
    // Optimistic: flip UI immediately, reconcile in background.
    onFavoritedChange(next);
    window.dispatchEvent(new CustomEvent("page-favorite-changed", { detail: { pageId, favorited: next } }));
    try {
      const res = await fetch(`/api/pages/${pageId}/favorite`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed");
      }
      window.dispatchEvent(new CustomEvent("pages-changed"));
    } catch {
      // Revert if the request failed.
      onFavoritedChange(!next);
      window.dispatchEvent(new CustomEvent("page-favorite-changed", { detail: { pageId, favorited: !next } }));
      showToast("Could not update favorite");
    }
  }, [favorited, onFavoritedChange, pageId, showToast]);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/pages/${pageId}`;
    void navigator.clipboard.writeText(url).then(
      () => showToast("Link copied"),
      () => showToast("Could not copy link")
    );
  }, [pageId, showToast]);

  const duplicatePage = useCallback(async () => {
    try {
      const res = await fetch(`/api/pages/${pageId}/duplicate`, { method: "POST" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((j as { error?: string }).error ?? "Failed");
      const newId = (j as { page?: { id: string } }).page?.id;
      if (!newId) throw new Error("No page id");
      window.dispatchEvent(new CustomEvent("pages-changed"));
      router.push(`/pages/${newId}`);
    } catch {
      showToast("Could not duplicate page");
    }
  }, [pageId, router, showToast]);

  const moveToTrash = useCallback(async () => {
    if (!confirm("Move this page to trash?")) return;
    try {
      const res = await fetch(`/api/pages/${pageId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed");
      }
      window.dispatchEvent(new CustomEvent("pages-changed"));
      router.push("/dashboard");
    } catch {
      showToast("Could not move to trash");
    }
  }, [pageId, router, showToast]);

  const toggleFullWidth = useCallback(async () => {
    const next = !fullWidthInitial;
    try {
      const res = await fetch(`/api/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_width: next }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed");
      }
      onFullWidthChange(next);
      router.refresh();
    } catch {
      showToast("Could not update layout");
    }
  }, [fullWidthInitial, onFullWidthChange, pageId, router, showToast]);

  return (
    <>
      <div className="flex shrink-0 items-center gap-0.5">
        <button type="button" className={actionTextClass} onClick={() => setShareOpen(true)}>
          Share
        </button>
        <button
          type="button"
          className={menuIconBtnClass}
          onClick={toggleFavorite}
          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={favorited}
        >
          <span
            className={`material-symbols-rounded leading-none ${
              favorited ? "text-[#ffc724] drop-shadow-[0_1px_0_rgba(0,0,0,0.12)]" : "text-mono-dark"
            }`}
            style={iconGlyphStyle({ favorited })}
          >
            star
          </span>
        </button>
        <button
          ref={menuAnchorRef}
          type="button"
          className={menuIconBtnClass}
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="More options"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
        >
          <span className="material-symbols-rounded leading-none text-mono-dark" style={iconGlyphStyle()}>
            more_horiz
          </span>
        </button>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[250] -translate-x-1/2 rounded-md bg-mono-dark px-4 py-2 text-[13px] text-white shadow-lg">
          {toast}
        </div>
      )}

      <PageShareModal open={shareOpen} onClose={() => setShareOpen(false)} pageId={pageId} />
      <PageMenuDrawer
        open={menuOpen}
        anchorRef={menuAnchorRef}
        onClose={() => setMenuOpen(false)}
        fullWidth={fullWidthInitial}
        onToggleFullWidth={toggleFullWidth}
        onCopyLink={copyLink}
        onDuplicate={duplicatePage}
        onMoveToTrash={moveToTrash}
      />
    </>
  );
}
