import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { normalizeRawName } from "@/lib/enrichment/normalize-raw-name";

type Sb = SupabaseClient<Database>;

export async function lookupMerchantMemory(
  supabase: Sb,
  workspaceId: string,
  rawName: string
): Promise<{
  normalized: string;
  displayName: string | null;
  source: "merchant_memory" | null;
  confidence: number | null;
}> {
  const normalized = normalizeRawName(rawName);
  if (!normalized) return { normalized, displayName: null, source: null, confidence: null };

  const { data, error } = await (supabase as any)
    .from("merchant_memory")
    .select("display_name, confirmed_count")
    .eq("workspace_id", workspaceId)
    .eq("raw_name_pattern", normalized)
    .maybeSingle();

  if (error || !data?.display_name) {
    return { normalized, displayName: null, source: null, confidence: null };
  }

  const confirmed = Number(data.confirmed_count ?? 0);
  const confidence = confirmed >= 2 ? 0.95 : confirmed === 1 ? 0.75 : 0.6;
  return { normalized, displayName: String(data.display_name), source: "merchant_memory", confidence };
}

export async function upsertMerchantMemory(
  supabase: Sb,
  params: {
    workspaceId: string;
    rawName: string;
    displayName: string;
    source: "ai_generated" | "user_correction" | "user_created";
    incrementConfirmed?: boolean;
    incrementCorrected?: boolean;
  }
) {
  const rawNamePattern = normalizeRawName(params.rawName);
  if (!rawNamePattern) return;

  const updates: Record<string, unknown> = {
    workspace_id: params.workspaceId,
    raw_name_pattern: rawNamePattern,
    display_name: params.displayName.slice(0, 255),
    source: params.source,
    updated_at: new Date().toISOString(),
  };

  // Supabase doesn't support atomic increment in upsert payload reliably across types;
  // we store as integers and update with a second call when needed.
  const { data, error } = await (supabase as any)
    .from("merchant_memory")
    .upsert(updates, { onConflict: "workspace_id,raw_name_pattern" })
    .select("id,confirmed_count,corrected_count")
    .maybeSingle();

  if (error || !data?.id) return;

  const incConfirmed = params.incrementConfirmed ? 1 : 0;
  const incCorrected = params.incrementCorrected ? 1 : 0;
  if (incConfirmed === 0 && incCorrected === 0) return;

  const nextConfirmed = Number(data.confirmed_count ?? 0) + incConfirmed;
  const nextCorrected = Number(data.corrected_count ?? 0) + incCorrected;

  await (supabase as any)
    .from("merchant_memory")
    .update({
      confirmed_count: nextConfirmed,
      corrected_count: nextCorrected,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id);
}

