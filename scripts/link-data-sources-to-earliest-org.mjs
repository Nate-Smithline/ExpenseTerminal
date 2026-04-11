#!/usr/bin/env node
/**
 * Set each data_sources.org_id to the earliest org (by org_memberships.created_at) for that row's user_id.
 * data_sources has no email field; we show profiles.email for the owning user in logs only.
 *
 * Dry-run (default): prints planned changes.
 *   node --env-file=.env.local scripts/link-data-sources-to-earliest-org.mjs
 *
 * Apply:
 *   node --env-file=.env.local scripts/link-data-sources-to-earliest-org.mjs --apply
 */

import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SECRET_KEY?.trim();

if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data: sources, error: sErr } = await supabase
  .from("data_sources")
  .select("id, user_id, org_id, name")
  .order("created_at", { ascending: true });

if (sErr) {
  console.error(sErr.message);
  process.exit(1);
}

/** @type {Map<string, string | null>} */
const emailByUserId = new Map();
const userIds = [...new Set((sources ?? []).map((r) => r.user_id))];

for (const uid of userIds) {
  const { data: prof } = await supabase.from("profiles").select("email").eq("id", uid).maybeSingle();
  emailByUserId.set(uid, prof?.email ?? null);
}

/** @type {Map<string, string | null>} */
const earliestOrgByUserId = new Map();

for (const uid of userIds) {
  const { data: rows, error: mErr } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", uid)
    .order("created_at", { ascending: true })
    .limit(1);

  if (mErr) {
    console.error("membership lookup failed", uid, mErr.message);
    process.exit(1);
  }
  earliestOrgByUserId.set(uid, rows?.[0]?.org_id ?? null);
}

let wouldChange = 0;
let skippedNoMembership = 0;
const plans = [];

for (const ds of sources ?? []) {
  const targetOrg = earliestOrgByUserId.get(ds.user_id);
  if (!targetOrg) {
    skippedNoMembership += 1;
    plans.push({
      data_source_id: ds.id,
      account: ds.name,
      user_id: ds.user_id,
      owner_email: emailByUserId.get(ds.user_id),
      action: "skip_no_membership",
      current_org_id: ds.org_id,
    });
    continue;
  }
  if (ds.org_id === targetOrg) {
    plans.push({
      data_source_id: ds.id,
      account: ds.name,
      user_id: ds.user_id,
      owner_email: emailByUserId.get(ds.user_id),
      action: "unchanged",
      org_id: ds.org_id,
    });
    continue;
  }
  wouldChange += 1;
  plans.push({
    data_source_id: ds.id,
    account: ds.name,
    user_id: ds.user_id,
    owner_email: emailByUserId.get(ds.user_id),
    action: APPLY ? "updated" : "would_update",
    from_org_id: ds.org_id,
    to_org_id: targetOrg,
  });
}

console.log(JSON.stringify(plans, null, 2));
console.error(
  `\nSummary: ${wouldChange} to ${APPLY ? "update" : "change (dry-run)"}, ` +
    `${skippedNoMembership} user(s) with no org membership, ` +
    `${(sources ?? []).length - wouldChange - skippedNoMembership} already correct.`
);

if (!APPLY) {
  console.error("\nRe-run with --apply to write org_id.");
  process.exit(0);
}

let failed = 0;
for (const ds of sources ?? []) {
  const targetOrg = earliestOrgByUserId.get(ds.user_id);
  if (!targetOrg || ds.org_id === targetOrg) continue;

  const { error: uErr } = await supabase.from("data_sources").update({ org_id: targetOrg }).eq("id", ds.id);

  if (uErr) {
    console.error("update failed", ds.id, uErr.message);
    failed += 1;
  }
}

if (failed) process.exit(1);
