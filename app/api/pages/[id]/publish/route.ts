/* eslint-disable @typescript-eslint/no-explicit-any -- pages not fully typed */
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { getActiveOrgId } from "@/lib/active-org";
import { ensureActiveOrgForUser } from "@/lib/ensure-active-org";
import { pagePublishPatchSchema } from "@/lib/validation/schemas";
import { absoluteUrlForPublishedPage } from "@/lib/publish-page-url";

async function resolveOrgId(supabase: any, userId: string): Promise<string> {
  const existing = await getActiveOrgId(supabase, userId);
  if (existing) return existing;
  return await ensureActiveOrgForUser(userId);
}

function newPublishToken(): string {
  return randomBytes(24).toString("base64url");
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const supabase = authClient;
    const orgId = await resolveOrgId(supabase, userId);
    const { id: pageId } = await ctx.params;

    const { data: page, error } = await (supabase as any)
      .from("pages")
      .select("id,publish_token")
      .eq("id", pageId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { error: safeErrorMessage(error.message, "Failed to load page") },
        { status: 500 }
      );
    }
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const token = typeof page.publish_token === "string" ? page.publish_token : null;
    const published = Boolean(token);
    const public_url = published && token ? absoluteUrlForPublishedPage(req, token) : null;

    return NextResponse.json({
      published,
      publish_token: token,
      public_url,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to load publish settings" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const authClient = await createSupabaseRouteClient();
    const auth = await requireAuth(authClient);
    if (!auth.authorized) {
      return NextResponse.json(auth.body, { status: auth.status });
    }
    const userId = auth.userId;
    const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
    if (!rlOk) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const supabase = authClient;
    const orgId = await resolveOrgId(supabase, userId);
    const { id: pageId } = await ctx.params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    const parsed = pagePublishPatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten().formErrors[0] ?? "Invalid body" },
        { status: 400 }
      );
    }

    const { published } = parsed.data;

    const { data: existing, error: loadErr } = await (supabase as any)
      .from("pages")
      .select("id,publish_token,publish_snapshot_user_id")
      .eq("id", pageId)
      .eq("org_id", orgId)
      .is("deleted_at", null)
      .maybeSingle();

    if (loadErr) {
      return NextResponse.json(
        { error: safeErrorMessage(loadErr.message, "Failed to load page") },
        { status: 500 }
      );
    }
    if (!existing) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    let nextToken: string | null = existing.publish_token ?? null;

    if (published) {
      if (!nextToken) {
        for (let i = 0; i < 5; i++) {
          const candidate = newPublishToken();
          const { error: upErr } = await (supabase as any)
            .from("pages")
            .update({
              publish_token: candidate,
              publish_snapshot_user_id: userId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", pageId)
            .eq("org_id", orgId)
            .is("deleted_at", null);

          if (!upErr) {
            nextToken = candidate;
            break;
          }
          if (!String(upErr.message ?? "").includes("unique") && !String(upErr.message ?? "").includes("duplicate")) {
            return NextResponse.json(
              { error: safeErrorMessage(upErr.message, "Failed to publish") },
              { status: 500 }
            );
          }
        }
        if (!nextToken) {
          return NextResponse.json({ error: "Could not generate publish link" }, { status: 500 });
        }
      }
    } else {
      const { error: upErr } = await (supabase as any)
        .from("pages")
        .update({
          publish_token: null,
          publish_snapshot_user_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pageId)
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (upErr) {
        return NextResponse.json(
          { error: safeErrorMessage(upErr.message, "Failed to unpublish") },
          { status: 500 }
        );
      }
      nextToken = null;
    }

    const public_url = nextToken ? absoluteUrlForPublishedPage(req, nextToken) : null;

    return NextResponse.json({
      published: Boolean(nextToken),
      publish_token: nextToken,
      public_url,
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to update publish settings" },
      { status: 500 }
    );
  }
}
