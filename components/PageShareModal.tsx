"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type OrgMember = {
  id: string;
  email: string | null;
  display_name: string | null;
  role: string;
};

type SharePerson = {
  user_id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  is_creator: boolean;
};

type Tab = "share" | "publish";

export function PageShareModal({
  open,
  onClose,
  pageId,
}: {
  open: boolean;
  onClose: () => void;
  pageId: string;
}) {
  const [tab, setTab] = useState<Tab>("share");
  const [loading, setLoading] = useState(false);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [people, setPeople] = useState<SharePerson[]>([]);
  const [visibility, setVisibility] = useState<"org" | "restricted">("org");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [publishLoading, setPublishLoading] = useState(false);
  const [publishSaving, setPublishSaving] = useState(false);
  const [published, setPublished] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishToast, setPublishToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, sRes] = await Promise.all([
        fetch("/api/orgs/members"),
        fetch(`/api/pages/${pageId}/share`),
      ]);
      const mJson = await mRes.json().catch(() => ({}));
      const sJson = await sRes.json().catch(() => ({}));
      if (!mRes.ok) throw new Error(mJson.error ?? "Failed to load members");
      if (!sRes.ok) throw new Error(sJson.error ?? "Failed to load share settings");
      setOrgMembers(Array.isArray(mJson.members) ? mJson.members : []);
      setPeople(Array.isArray(sJson.people) ? sJson.people : []);
      setVisibility(sJson.visibility === "restricted" ? "restricted" : "org");
      setCurrentUserId(typeof sJson.current_user_id === "string" ? sJson.current_user_id : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (!open) return;
    loadAll();
    setTab("share");
    setQuery("");
  }, [open, loadAll]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    const invited = new Set(people.map((p) => p.user_id));
    return orgMembers.filter((m) => {
      if (invited.has(m.id)) return false;
      if (!q) return true;
      const name = (m.display_name ?? "").toLowerCase();
      const email = (m.email ?? "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [orgMembers, people, query]);

  const setAccess = async (next: "org" | "restricted") => {
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/share`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to update");
      setVisibility(next);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to update");
    }
  };

  const invite = async (userId: string) => {
    setInviteBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to invite");
      await loadAll();
      setQuery("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to invite");
    } finally {
      setInviteBusy(false);
    }
  };

  const removeAccess = async (userId: string) => {
    if (!confirm("Remove this person’s access to the page?")) return;
    setError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/share?user_id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Failed to remove");
      await loadAll();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to remove");
    }
  };

  const loadPublish = useCallback(async () => {
    setPublishLoading(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/publish`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to load publish settings");
      setPublished(Boolean((json as { published?: boolean }).published));
      const url = (json as { public_url?: string | null }).public_url;
      setPublicUrl(typeof url === "string" && url.length > 0 ? url : null);
    } catch (e: unknown) {
      setPublishError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setPublishLoading(false);
    }
  }, [pageId]);

  useEffect(() => {
    if (!open || tab !== "publish") return;
    void loadPublish();
  }, [open, tab, loadPublish]);

  const setPublishedRemote = async (next: boolean) => {
    setPublishSaving(true);
    setPublishError(null);
    try {
      const res = await fetch(`/api/pages/${pageId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string }).error ?? "Failed to update");
      setPublished(Boolean((json as { published?: boolean }).published));
      const url = (json as { public_url?: string | null }).public_url;
      setPublicUrl(typeof url === "string" && url.length > 0 ? url : null);
    } catch (e: unknown) {
      setPublishError(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setPublishSaving(false);
    }
  };

  const copyPublishLink = () => {
    if (!publicUrl) return;
    void navigator.clipboard.writeText(publicUrl).then(
      () => {
        setPublishToast("Link copied");
        setTimeout(() => setPublishToast(null), 2000);
      },
      () => setPublishError("Could not copy link")
    );
  };

  if (!open) return null;

  const tabBtnBase =
    "flex-1 px-3 py-1.5 min-w-[100px] text-center text-sm font-sans font-medium transition-colors sm:flex-none";
  const tabActive = "bg-[#8A9BB0] text-black";
  const tabInactive = "bg-white text-black hover:bg-[#8A9BB0]/10";

  return (
    <div
      className="fixed inset-0 z-[190] flex min-h-[100dvh] items-center justify-center bg-black/30 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-none border border-bg-tertiary/40 bg-white shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-share-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 bg-white px-6 pb-1 pt-6">
          <h2 id="page-share-modal-title" className="font-sans text-xl font-medium text-mono-dark">
            Share and publish
          </h2>
        </div>

        <div className="shrink-0 px-6 pb-4 pt-2">
          <div
            className="inline-flex w-full border border-[#8A9BB0] bg-white font-sans text-sm font-medium sm:w-auto"
            role="tablist"
            aria-label="Share or publish"
          >
            <button
              type="button"
              role="tab"
              aria-selected={tab === "share"}
              onClick={() => setTab("share")}
              className={`${tabBtnBase} border-r border-[#8A9BB0] ${tab === "share" ? tabActive : tabInactive}`}
            >
              Share
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "publish"}
              onClick={() => setTab("publish")}
              className={`${tabBtnBase} ${tab === "publish" ? tabActive : tabInactive}`}
            >
              Publish
            </button>
          </div>
        </div>

        {tab === "publish" ? (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
            {publishError && <div className="text-sm text-red-600">{publishError}</div>}
            {publishLoading ? (
              <div className="py-6 text-center text-sm text-mono-medium">Loading…</div>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-mono-medium">
                  Anyone with the link can view a read-only copy with this page’s columns, sort, and filters.
                  Transaction rows come from whoever first turned publishing on (for your org’s pages, that is
                  usually you). Viewers cannot edit data.
                </p>
                <div className="flex items-center justify-between gap-3 rounded-none border border-bg-tertiary/60 px-3 py-2">
                  <span className="text-sm font-medium text-mono-dark">Publish to web</span>
                  <button
                    type="button"
                    disabled={publishSaving}
                    onClick={() => setPublishedRemote(!published)}
                    className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                      published ? "bg-sovereign-blue" : "bg-bg-tertiary"
                    } disabled:opacity-50`}
                    aria-pressed={published}
                    aria-label={published ? "Turn off published link" : "Turn on published link"}
                  >
                    <span
                      className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        published ? "left-5" : "left-0.5"
                      }`}
                    />
                  </button>
                </div>
                {published && publicUrl ? (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-mono-medium">Public link</label>
                    <div className="flex gap-2">
                      <input
                        readOnly
                        value={publicUrl}
                        className="min-w-0 flex-1 rounded-none border border-bg-tertiary/60 bg-bg-secondary/20 px-3 py-2 text-xs text-mono-dark"
                      />
                      <button
                        type="button"
                        onClick={copyPublishLink}
                        className="shrink-0 rounded-none bg-[#F0F1F7] px-3 py-2 text-xs font-medium text-mono-dark hover:bg-[#F5F0E8]"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}
                {publishToast ? (
                  <p className="text-xs text-mono-medium" role="status">
                    {publishToast}
                  </p>
                ) : null}
              </>
            )}
          </div>
        ) : (
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-3">
            {error && <div className="text-sm text-red-600">{error}</div>}
            {loading ? (
              <div className="py-6 text-center text-sm text-mono-medium">Loading…</div>
            ) : (
              <>
                <div>
                  <label className="sr-only" htmlFor="share-invite-search">
                    Search people in your organization
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="share-invite-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Email or name…"
                      className="min-w-0 flex-1 rounded-none border border-bg-tertiary/60 px-3 py-2 text-sm text-mono-dark placeholder:text-mono-light"
                    />
                  </div>
                  {query.trim().length > 0 && filteredMembers.length > 0 && (
                    <ul className="mt-2 max-h-40 divide-y divide-bg-tertiary/30 overflow-y-auto rounded-none border border-bg-tertiary/60">
                      {filteredMembers.slice(0, 8).map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            disabled={inviteBusy}
                            onClick={() => invite(m.id)}
                            className="w-full px-3 py-2 text-left text-sm hover:bg-bg-secondary/80 disabled:opacity-50"
                          >
                            <span className="font-medium text-mono-dark">
                              {m.display_name?.trim() || m.email || "Member"}
                            </span>
                            {m.email && m.display_name?.trim() ? (
                              <span className="block text-xs text-mono-light">{m.email}</span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-mono-medium">People with access</div>
                  <ul className="space-y-2">
                    {people.map((p) => (
                      <li
                        key={p.user_id}
                        className="flex items-center justify-between gap-2 border-b border-bg-tertiary/30 py-1 last:border-0"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-mono-dark">
                            {p.display_name?.trim() || p.email || "User"}
                            {p.user_id === currentUserId ? " (you)" : ""}
                          </div>
                          {p.email ? (
                            <div className="truncate text-xs text-mono-light">{p.email}</div>
                          ) : null}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs capitalize text-mono-medium">
                            {p.is_creator ? "Owner" : p.role.replace("_", " ")}
                          </span>
                          {!p.is_creator && p.user_id !== currentUserId && (
                            <button
                              type="button"
                              onClick={() => removeAccess(p.user_id)}
                              className="text-xs text-mono-light hover:text-red-600"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div className="mb-2 text-xs font-medium text-mono-medium">General access</div>
                  <div
                    className="overflow-hidden rounded-lg border border-bg-tertiary/60"
                    role="radiogroup"
                    aria-label="Who can access this page"
                  >
                    <button
                      type="button"
                      role="radio"
                      aria-checked={visibility === "org"}
                      onClick={() => setAccess("org")}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-bg-secondary/50 ${
                        visibility === "org" ? "bg-bg-secondary/80" : ""
                      }`}
                    >
                      <span
                        className="material-symbols-rounded shrink-0 text-[20px] text-mono-medium"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                      >
                        groups
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-mono-dark">Everyone in organization</span>
                      {visibility === "org" ? (
                        <span className="material-symbols-rounded shrink-0 text-[18px] text-mono-light">check</span>
                      ) : null}
                    </button>
                    <div className="h-px bg-bg-tertiary/50" />
                    <button
                      type="button"
                      role="radio"
                      aria-checked={visibility === "restricted"}
                      onClick={() => setAccess("restricted")}
                      className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-bg-secondary/50 ${
                        visibility === "restricted" ? "bg-bg-secondary/80" : ""
                      }`}
                    >
                      <span
                        className="material-symbols-rounded shrink-0 text-[20px] text-mono-medium"
                        style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
                      >
                        lock_person
                      </span>
                      <span className="min-w-0 flex-1 font-medium text-mono-dark">Only people invited</span>
                      {visibility === "restricted" ? (
                        <span className="material-symbols-rounded shrink-0 text-[18px] text-mono-light">check</span>
                      ) : null}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-mono-light">
                    {visibility === "org"
                      ? "All members of your active organization can open this page."
                      : "Only you and invited people can open this page."}
                  </p>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex shrink-0 justify-end gap-3 border-t border-bg-tertiary/40 px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-none bg-[#F0F1F7] px-4 py-2.5 font-sans text-sm font-medium text-mono-dark transition hover:bg-[#F5F0E8]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
