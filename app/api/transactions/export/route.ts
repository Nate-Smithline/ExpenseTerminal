import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { ACTIVITY_SORT_COLUMNS } from "@/lib/validation/schemas";
import { safeErrorMessage } from "@/lib/api/safe-error";

/**
 * GET: Export activity transactions as CSV or PDF.
 * Query params: format=csv|pdf, date_from, date_to, status?, transaction_type?, search?, sort_by?, sort_order?
 * Uses same filters as the activity table.
 */
export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format");
  if (format !== "csv" && format !== "pdf") {
    return NextResponse.json({ error: "Use ?format=csv or ?format=pdf" }, { status: 400 });
  }

  const dateFrom = searchParams.get("date_from")?.trim() || null;
  const dateTo = searchParams.get("date_to")?.trim() || null;
  const status = searchParams.get("status");
  const txType = searchParams.get("transaction_type");
  const searchTerm = (searchParams.get("search") ?? searchParams.get("q"))?.trim() ?? "";
  const sortByRaw = searchParams.get("sort_by") ?? searchParams.get("sort");
  const sortBy = sortByRaw && (ACTIVITY_SORT_COLUMNS as readonly string[]).includes(sortByRaw) ? sortByRaw : "date";
  const sortOrderRaw = searchParams.get("sort_order") ?? searchParams.get("order");
  const sortAsc = sortOrderRaw === "asc";

  const cols = "id,date,vendor,description,amount,transaction_type,status,category,schedule_c_line,business_purpose,notes";
  let query = (supabase as any)
    .from("transactions")
    .select(cols)
    .eq("user_id", userId)
    .order(sortBy, { ascending: sortAsc })
    .limit(5000);

  if (dateFrom) query = query.gte("date", dateFrom);
  if (dateTo) query = query.lte("date", dateTo);
  if (status) query = query.eq("status", status);
  if (txType) query = query.eq("transaction_type", txType);
  if (searchTerm.length > 0) {
    const pattern = `%${searchTerm}%`;
    query = query.or(`vendor.ilike.${pattern},description.ilike.${pattern}`);
  }

  const { data: transactions, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to load transactions") },
      { status: 500 }
    );
  }

  const rows = (transactions ?? []) as Record<string, unknown>[];

  if (format === "csv") {
    const headers = ["Date", "Vendor", "Description", "Amount", "Type", "Status", "Category", "Schedule C Line", "Business Purpose", "Notes"];
    const csvRows = rows.map((t) => [
      t.date ?? "",
      t.vendor ?? "",
      t.description ?? "",
      t.amount ?? "",
      t.transaction_type ?? "",
      t.status ?? "",
      t.category ?? "",
      t.schedule_c_line ?? "",
      t.business_purpose ?? "",
      t.notes ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...csvRows.map((r: unknown[]) =>
        r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
      ),
    ].join("\n");

    const filename = `activity-export-${dateFrom ?? "all"}-to-${dateTo ?? "all"}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF({ orientation: "landscape" });

    doc.setFontSize(14);
    doc.text("Activity export", 14, 14);
    doc.setFontSize(10);
    doc.text(
      `Exported ${rows.length} transaction(s). Date range: ${dateFrom ?? "—"} to ${dateTo ?? "—"}.`,
      14,
      20
    );

    const tableData = rows.map((t) => [
      String(t.date ?? ""),
      String(t.vendor ?? "").slice(0, 24),
      String(t.amount ?? ""),
      String(t.transaction_type ?? ""),
      String(t.status ?? ""),
      String(t.category ?? "").slice(0, 18),
    ]);

    autoTable(doc, {
      startY: 26,
      head: [["Date", "Vendor", "Amount", "Type", "Status", "Category"]],
      body: tableData,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 71] },
      styles: { fontSize: 8 },
    });

    const buf = Buffer.from(doc.output("arraybuffer"));
    const filename = `activity-export-${dateFrom ?? "all"}-to-${dateTo ?? "all"}.pdf`;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return NextResponse.json({ error: "Invalid format" }, { status: 400 });
}
