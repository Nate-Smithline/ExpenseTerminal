import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";

export type DashboardPageStripItem = {
  id: string;
  title: string;
  icon_type: string;
  icon_value: string;
  icon_color: string;
  updated_at: string;
};

async function resolveOrgId(supabase: any, userId: string): Promise<string | null> {
  let orgId = await getActiveOrgId(supabase as any, userId);
  if (!orgId) {
    try {
      orgId = await ensureActiveOrgForUser(userId);
    } catch {
      orgId = null;
    }
  }
  return orgId;
}

/**
 * Pages for the Notion-style home strip: favorites first (by favorite created_at), then recent by page updated_at.
 */
export async function loadDashboardPageStrip(
  supabase: any,
  userId: string,
  limit = 12,
): Promise<DashboardPageStripItem[]> {
  const orgId = await resolveOrgId(supabase, userId);
  if (!orgId) return [];

  const [{ data: pages }, { data: favs }] = await Promise.all([
    supabase
      .from("pages")
      .select("id,title,icon_type,icon_value,icon_color,updated_at,position")
      .eq("org_id", orgId)
      .is("deleted_at", null),
    supabase
      .from("page_favorites")
      .select("page_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true }),
  ]);

  const pageList = (pages ?? []) as Array<{
    id: string;
    title: string;
    icon_type: string;
    icon_value: string;
    icon_color: string;
    updated_at: string;
    position: number;
  }>;

  const favRows = (favs ?? []) as Array<{ page_id: string; created_at: string }>;
  const favOrder = new Map<string, number>();
  favRows.forEach((f, i) => favOrder.set(f.page_id, i));

  const byId = new Map(pageList.map((p) => [p.id, p]));

  const favoritePages: typeof pageList = [];
  for (const f of favRows) {
    const p = byId.get(f.page_id);
    if (p) favoritePages.push(p);
  }

  const favSet = new Set(favoritePages.map((p) => p.id));
  const rest = pageList
    .filter((p) => !favSet.has(p.id))
    .sort((a, b) => {
      const ta = new Date(a.updated_at).getTime();
      const tb = new Date(b.updated_at).getTime();
      return tb - ta;
    });

  const merged = [...favoritePages, ...rest].slice(0, limit);

  return merged.map((p) => ({
    id: p.id,
    title: (p.title ?? "").trim() || "Untitled",
    icon_type: p.icon_type ?? "emoji",
    icon_value: p.icon_value ?? "📄",
    icon_color: p.icon_color ?? "grey",
    updated_at: p.updated_at,
  }));
}

/** All org pages (by position) for dashboard period + page scope UI. */
export async function loadOrgPagesForDashboardSelect(
  supabase: any,
  userId: string,
): Promise<Array<{ id: string; title: string }>> {
  const orgId = await resolveOrgId(supabase, userId);
  if (!orgId) return [];

  const { data: pages } = await supabase
    .from("pages")
    .select("id,title,position")
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("position", { ascending: true });

  return ((pages ?? []) as Array<{ id: string; title: string | null }>).map((p) => ({
    id: p.id,
    title: (p.title ?? "").trim() || "Untitled",
  }));
}
