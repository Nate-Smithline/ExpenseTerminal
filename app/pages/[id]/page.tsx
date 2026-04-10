/* eslint-disable @typescript-eslint/no-explicit-any -- pages table not in generated Database types */
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/get-current-user";
import { getActiveOrgId } from "@/lib/active-org";
import { uuidSchema } from "@/lib/validation/schemas";

import { PageViewClientNoSSR } from "./page-view-client-nossr";

export default async function PageView({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const userId = await getCurrentUserId(supabase);
  if (!userId) redirect("/login");

  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const orgId = await getActiveOrgId(supabase as any, userId);
  if (!orgId) redirect("/dashboard");

  const { data: page } = await (supabase as any)
    .from("pages")
    .select(
      "id,title,icon_type,icon_value,icon_color,org_id,full_width,visibility,created_by,deleted_at"
    )
    .eq("id", id)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!page) notFound();

  const { data: fav } = await (supabase as any)
    .from("page_favorites")
    .select("page_id")
    .eq("user_id", userId)
    .eq("page_id", id)
    .maybeSingle();

  return (
    <PageViewClientNoSSR
      page={{
        id: page.id,
        title: page.title,
        icon_type: page.icon_type,
        icon_value: page.icon_value,
        icon_color: page.icon_color,
        full_width: Boolean(page.full_width),
        favorited: Boolean(fav),
      }}
    />
  );
}
