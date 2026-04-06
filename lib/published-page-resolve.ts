/* eslint-disable @typescript-eslint/no-explicit-any -- service client + dynamic tables */
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { normalizePublishedViewSettingsRow, type NormalizedPublishedView } from "@/lib/published-page-view";

type Svc = ReturnType<typeof createSupabaseServiceClient>;

export type PublishedPageBundle = {
  ownerUserId: string;
  orgId: string | null;
  page: {
    title: string;
    icon_type: string;
    icon_value: string;
    icon_color: string;
    full_width: boolean;
  };
  view: NormalizedPublishedView;
};

export async function fetchPublishedPageBundle(svc: Svc, rawToken: string): Promise<PublishedPageBundle | null> {
  const token = decodeURIComponent(rawToken).trim();
  if (!token || token.length > 200) return null;

  const { data: page, error } = await (svc as any)
    .from("pages")
    .select(
      "id,org_id,title,icon_type,icon_value,icon_color,full_width,created_by,publish_token,publish_snapshot_user_id,deleted_at"
    )
    .eq("publish_token", token)
    .is("deleted_at", null)
    .maybeSingle();

  if (error || !page || !page.publish_token) return null;

  const ownerUserId =
    (typeof page.publish_snapshot_user_id === "string" ? page.publish_snapshot_user_id : null) ??
    (page.created_by as string);
  if (!ownerUserId) return null;

  const { data: settings } = await (svc as any)
    .from("page_activity_view_settings")
    .select("sort_column,sort_asc,visible_columns,column_widths,filters")
    .eq("page_id", page.id)
    .maybeSingle();

  const view = normalizePublishedViewSettingsRow(settings as Record<string, unknown> | null);

  const orgId = typeof page.org_id === "string" ? page.org_id : null;

  return {
    ownerUserId,
    orgId,
    page: {
      title: typeof page.title === "string" ? page.title : "",
      icon_type: typeof page.icon_type === "string" ? page.icon_type : "emoji",
      icon_value: typeof page.icon_value === "string" ? page.icon_value : "📄",
      icon_color: typeof page.icon_color === "string" ? page.icon_color : "grey",
      full_width: Boolean(page.full_width),
    },
    view,
  };
}
