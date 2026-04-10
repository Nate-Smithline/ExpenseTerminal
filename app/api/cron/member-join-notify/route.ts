/* eslint-disable @typescript-eslint/no-explicit-any -- service client + queue typing */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getResendClient, getFromAddress, RESEND_TIMEOUT_MS } from "@/lib/email/resend";
import { withRetry } from "@/lib/api/retry";
import {
  orgMemberJoinedEmailHtml,
  orgMemberJoinedEmailText,
} from "@/lib/email/templates/org-member-joined";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const BATCH = 50;

function siteBaseUrl(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  return process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL.replace(/\/$/, "")}`
    : "https://expenseterminal.com";
}

function memberDisplayLabel(profile: {
  display_name?: string | null;
  first_name?: string | null;
  email?: string | null;
}): string {
  const d = typeof profile.display_name === "string" && profile.display_name.trim();
  if (d) return d;
  const f = typeof profile.first_name === "string" && profile.first_name.trim();
  if (f) return f;
  const e = typeof profile.email === "string" && profile.email.trim();
  if (e) return e;
  return "A new member";
}

/**
 * Cron: drain org_member_join_notify_queue and email all owners of each org (Resend).
 * Authorization: Bearer CRON_SECRET (same as other cron routes).
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not configured. Set CRON_SECRET in Vercel Environment Variables (and .env.local for local runs).",
      },
      { status: 503 }
    );
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let resend: ReturnType<typeof getResendClient> | null = null;
  try {
    resend = getResendClient();
  } catch {
    resend = null;
  }

  if (!resend) {
    return NextResponse.json(
      { error: "Resend is not configured (RESEND_API_KEY / from address)." },
      { status: 503 }
    );
  }

  const svc = createSupabaseServiceClient();
  const baseUrl = siteBaseUrl();
  const workspaceUrl = `${baseUrl}/preferences/org`;

  const { data: rows, error: qErr } = await (svc as any)
    .from("org_member_join_notify_queue")
    .select("id, org_id, member_user_id")
    .order("created_at", { ascending: true })
    .limit(BATCH);

  if (qErr) {
    return NextResponse.json(
      { error: qErr.message ?? "Failed to read queue" },
      { status: 500 }
    );
  }

  const processed: string[] = [];
  const failures: { id: string; error: string }[] = [];

  for (const row of rows ?? []) {
    const id = row.id as string;
    const orgId = row.org_id as string;
    const memberUserId = row.member_user_id as string;

    const { data: orgRow } = await (svc as any)
      .from("orgs")
      .select("name")
      .eq("id", orgId)
      .maybeSingle();
    const orgName =
      typeof orgRow?.name === "string" && orgRow.name.trim() ? orgRow.name.trim() : "Workspace";

    const { data: memberProfile } = await (svc as any)
      .from("profiles")
      .select("display_name, first_name, email")
      .eq("id", memberUserId)
      .maybeSingle();

    const memberLabel = memberDisplayLabel(memberProfile ?? {});

    const { data: ownerRows, error: ownErr } = await (svc as any)
      .from("org_memberships")
      .select("user_id")
      .eq("org_id", orgId)
      .eq("role", "owner");

    if (ownErr) {
      failures.push({ id, error: ownErr.message ?? "owner lookup" });
      continue;
    }

    const ownerIds = [...new Set((ownerRows ?? []).map((r: any) => r.user_id as string))];
    const ownerEmails: string[] = [];

    for (const oid of ownerIds) {
      const { data: op } = await (svc as any)
        .from("profiles")
        .select("email")
        .eq("id", oid)
        .maybeSingle();
      const em = typeof op?.email === "string" ? op.email.trim() : "";
      if (em) ownerEmails.push(em);
    }

    if (ownerEmails.length === 0) {
      await (svc as any).from("org_member_join_notify_queue").delete().eq("id", id);
      processed.push(id);
      continue;
    }

    let allSent = true;
    for (const to of ownerEmails) {
      try {
        const sendPromise = resend.emails.send({
          from: getFromAddress(),
          to,
          subject: `${memberLabel} joined ${orgName} on Expense Terminal`,
          html: orgMemberJoinedEmailHtml({ orgName, memberLabel, workspaceUrl }),
          text: orgMemberJoinedEmailText({ orgName, memberLabel, workspaceUrl }),
          headers: { "X-Entity-Ref-ID": crypto.randomUUID() },
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Email send timeout")), RESEND_TIMEOUT_MS)
        );
        await withRetry(() => Promise.race([sendPromise, timeoutPromise]), {
          maxRetries: 2,
          initialMs: 1000,
          maxMs: 10_000,
        });
      } catch (e) {
        console.warn("[cron/member-join-notify] send failed", { id, to, e });
        allSent = false;
        break;
      }
    }

    if (allSent) {
      await (svc as any).from("org_member_join_notify_queue").delete().eq("id", id);
      processed.push(id);
    } else {
      failures.push({ id, error: "One or more owner emails failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    processed: processed.length,
    failures: failures.length,
    failureDetails: failures,
  });
}
