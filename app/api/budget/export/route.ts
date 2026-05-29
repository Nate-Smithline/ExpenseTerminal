import { NextRequest, NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supa = any;

type TxRow = {
  id: string;
  date: string;
  vendor: string | null;
  description: string | null;
  amount: number | string;
  transaction_type: string | null;
  category: string | null;
};

type AssignmentRow = {
  transaction_id: string;
  budget_lines: {
    name: string;
    budget_groups: { name: string; kind?: string | null } | null;
  } | null;
};

function csvCell(value: unknown): string {
  if (value == null) return '""';
  return `"${String(value).replace(/"/g, '""')}"`;
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(",");
}

/**
 * GET /api/budget/export?month=YYYY-MM
 * Downloads a CSV of all transactions in the month with budget group & line assignment.
 */
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseRouteClient();
  const auth = await requireAuth(supabase);
  if (!auth.authorized) return NextResponse.json(auth.body, { status: auth.status });
  const userId = auth.userId;

  const { success: rlOk } = await rateLimitForRequest(req, userId, generalApiLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const month = req.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month param required (YYYY-MM)" }, { status: 400 });
  }

  const [y, m] = month.split("-").map(Number);
  const startDate = `${month}-01`;
  const endDate = new Date(y, m, 0).toISOString().slice(0, 10);

  const db = supabase as Supa;

  const { data: txns, error: txErr } = await db
    .from("transactions")
    .select("id, date, vendor, description, amount, transaction_type, category")
    .eq("user_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 });

  const rows = (txns ?? []) as TxRow[];
  const assignmentByTxId = new Map<
    string,
    { groupName: string; lineName: string; groupKind: string }
  >();

  if (rows.length > 0) {
    const txIds = rows.map((t) => t.id);
    let links: AssignmentRow[] | null = null;
    let linkErr: { message: string } | null = null;

    const withKind = await db
      .from("budget_line_transactions")
      .select(`
        transaction_id,
        budget_lines (
          name,
          budget_groups ( name, kind )
        )
      `)
      .eq("user_id", userId)
      .in("transaction_id", txIds);

    if (withKind.error && /kind/i.test(withKind.error.message)) {
      const withoutKind = await db
        .from("budget_line_transactions")
        .select(`
          transaction_id,
          budget_lines (
            name,
            budget_groups ( name )
          )
        `)
        .eq("user_id", userId)
        .in("transaction_id", txIds);
      links = withoutKind.data;
      linkErr = withoutKind.error;
    } else {
      links = withKind.data;
      linkErr = withKind.error;
    }

    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

    for (const link of (links ?? []) as AssignmentRow[]) {
      const line = link.budget_lines;
      const group = line?.budget_groups;
      if (!line || !group) continue;
      assignmentByTxId.set(link.transaction_id, {
        groupName: group.name,
        lineName: line.name,
        groupKind: group.kind === "income" ? "income" : "expense",
      });
    }
  }

  const headers = [
    "Date",
    "Vendor",
    "Description",
    "Amount",
    "Transaction Type",
    "Category",
    "Budget Group",
    "Budget Line",
    "Group Type",
  ];

  const csvLines = [
    csvRow(headers),
    ...rows.map((t) => {
      const a = assignmentByTxId.get(t.id);
      return csvRow([
        t.date,
        t.vendor ?? "",
        t.description ?? "",
        t.amount,
        t.transaction_type ?? "",
        t.category ?? "",
        a?.groupName ?? "",
        a?.lineName ?? "",
        a?.groupKind ?? "",
      ]);
    }),
  ];

  const csv = csvLines.join("\n");
  const filename = `budget-transactions-${month}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
