import { getActiveOrgId } from "@/lib/active-org";

export type DashboardSelectPage = {
  id: string;
  title: string;
};

export type DashboardStripPage = {
  id: string;
  title: string;
  icon_type: string;
  icon_value: string;
  icon_color: string;
};

async function loadOrgPages(
  supabase: any,
  userId: string,
  limit: number,
  columns: string,
): Promise<Record<string, unknown>[]> {
  const orgId = await getActiveOrgId(supabase, userId);
  if (!orgId) return [];

  const { data, error } = await supabase
    .from("pages")
    .select(columns)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error || !Array.isArray(data)) return [];
  return data;
}

/** Toolbar / period scope dropdown — id + title only. */
export async function loadOrgPagesForDashboardSelect(
  supabase: unknown,
  userId: string,
): Promise<DashboardSelectPage[]> {
  const rows = await loadOrgPages(supabase as any, userId, 500, "id,title");
  return rows.map((p) => ({
    id: String(p.id),
    title: String(p.title ?? "").trim() || "Untitled",
  }));
}

/** Horizontal strip under the dashboard header. */
export async function loadDashboardPageStrip(
  supabase: unknown,
  userId: string,
  limit: number,
): Promise<DashboardStripPage[]> {
  const rows = await loadOrgPages(
    supabase as any,
    userId,
    limit,
    "id,title,icon_type,icon_value,icon_color",
  );
  return rows.map((p) => {
    const iconType = typeof p.icon_type === "string" && p.icon_type ? p.icon_type : "emoji";
    const rawVal = p.icon_value;
    const iconValue =
      typeof rawVal === "string" && rawVal.length > 0
        ? rawVal
        : iconType === "material"
          ? "description"
          : "📄";
    return {
      id: String(p.id),
      title: String(p.title ?? "").trim() || "Untitled",
      icon_type: iconType,
      icon_value: iconValue,
      icon_color: typeof p.icon_color === "string" && p.icon_color ? p.icon_color : "grey",
    };
  });
}
