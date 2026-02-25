import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import { filterByQuarter, calculateTaxSummary, calculateScheduleSE, filterDeductibleTransactions } from "@/lib/tax/form-calculations";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";

type TxRecord = {
  amount: string | number;
  date: string;
  vendor?: string;
  transaction_type: string | null;
  category: string | null;
  schedule_c_line: string | null;
  is_meal: boolean | null;
  is_travel: boolean | null;
  deduction_percent: number | null;
  status?: string | null;
  quick_label?: string | null;
  business_purpose?: string | null;
  notes?: string | null;
};

function deductibleAmount(t: TxRecord): number {
  const amt = Number(t.amount);
  if (t.is_travel) return amt;
  return t.is_meal ? amt * 0.5 : amt;
}

export async function GET(req: Request) {
  const authClient = await createSupabaseRouteClient();
  const auth = await requireAuth(authClient);
  if (!auth.authorized) {
    return NextResponse.json(auth.body, { status: auth.status });
  }
  const userId = auth.userId;
  const { success: rlOk } = await rateLimitForRequest(req, userId, expensiveOpLimit);
  if (!rlOk) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }
  const supabase = authClient;

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format"); // "csv" | "pdf"
  const taxYearParam = searchParams.get("tax_year");
  const taxYear = taxYearParam ? parseInt(taxYearParam, 10) : new Date().getFullYear();
  const typeFilter = searchParams.get("type"); // "expense" | "income" | empty = all
  const quarterParam = searchParams.get("quarter");
  const quarter = quarterParam ? parseInt(quarterParam, 10) : null;
  const scheduleCParam = searchParams.get("schedule_c");
  const scheduleSEParam = searchParams.get("schedule_se");
  const categoriesParam = searchParams.get("categories");
  const auditOnlyParam = searchParams.get("audit_only");

  const rawIncludeScheduleC = scheduleCParam === "true";
  const rawIncludeScheduleSE = scheduleSEParam === "true";
  const rawIncludeCategories = categoriesParam === "true";
  const anyExplicitSectionFlag =
    scheduleCParam !== null || scheduleSEParam !== null || categoriesParam !== null;

  const includeScheduleC = anyExplicitSectionFlag ? rawIncludeScheduleC : true;
  const includeScheduleSE = anyExplicitSectionFlag ? rawIncludeScheduleSE : true;
  const includeCategories = anyExplicitSectionFlag ? rawIncludeCategories : true;
  const includeAuditOnly = auditOnlyParam === "true";

  const txCols =
    "id,vendor,amount,date,status,transaction_type,schedule_c_line,category,is_meal,is_travel,deduction_percent,quick_label,business_purpose,notes";
  let txQuery = (supabase as any)
    .from("transactions")
    .select(txCols)
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .in("status", ["completed", "auto_sorted"])
    .order("date", { ascending: false });
  if (typeFilter === "expense" || typeFilter === "income") {
    txQuery = txQuery.eq("transaction_type", typeFilter);
  }
  const { data: transactions } = await txQuery;

  const deductionCols = "type,amount,tax_savings";
  const { data: deductions } = await (supabase as any)
    .from("deductions")
    .select(deductionCols)
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  const { data: taxSettings } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .single();

  const taxRate = taxSettings?.tax_rate ? Number(taxSettings.tax_rate) : 0.24;

  const allTx = (transactions ?? []) as TxRecord[];
  const quarterFilteredTx = filterByQuarter(allTx, quarter);

  if (format === "csv") {
    const headers = [
      "Type",
      "Date",
      "Vendor",
      "Amount",
      "Category",
      "Schedule C Line",
      "Business Purpose",
      "Notes",
    ];
    const rows = quarterFilteredTx.map((t: TxRecord) => [
      (t.transaction_type as string) ?? "expense",
      t.date,
      t.vendor ?? "",
      t.amount,
      t.category ?? "",
      t.schedule_c_line ?? "",
      t.business_purpose ?? "",
      t.notes ?? "",
    ]);
    const csv = [headers.join(","), ...rows.map((r: (string | number)[]) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transactions-${taxYear}.csv"`,
      },
    });
  }

  if (format === "pdf") {
    const { jsPDF } = await import("jspdf");
    const autoTable = (await import("jspdf-autotable")).default;
    const doc = new jsPDF();

    doc.setFontSize(20);
    const quarterLabel = quarter ? `Q${quarter} ` : "";
    doc.text(`${taxYear} ${quarterLabel}Self-employment tax packet`, 20, 20);
    doc.setFontSize(10);
    doc.text(
      "Prepared from ExpenseTerminal data for your records and tax professional — this is a summary, not an official IRS form.",
      20,
      27,
    );

    // Build summary used for all sections
    const deductionsForSummary = (deductions ?? []).map(
      (d: { type: string; amount: string }) => ({
        type: d.type,
        amount: d.amount,
      }),
    );
    const summary = calculateTaxSummary(
      quarterFilteredTx as any,
      deductionsForSummary as any,
      taxRate,
    );

    // Front-page summary: high-level numbers that map to Schedule C/SE
    const frontRows: string[][] = [
      ["Gross receipts from business (ref. Schedule C line 1)", `$${summary.grossIncome.toFixed(2)}`],
      ["Total deductible expenses in this packet", `$${summary.totalExpenses.toFixed(2)}`],
      ["Net profit used for Schedule SE", `$${summary.netProfit.toFixed(2)}`],
      ["Estimated total annual tax (income + SE)", `$${(summary.estimatedQuarterlyPayment * 4).toFixed(2)}`],
      ["Estimated quarterly payment", `$${summary.estimatedQuarterlyPayment.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 34,
      head: [["Item", "Amount"]],
      body: frontRows,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 71] },
    });

    // Short additional-deductions note if present
    if ((deductions ?? []).length > 0) {
      const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } })
        .lastAutoTable;
      const finalY = lastTable?.finalY ?? 34;
      doc.setFontSize(10);
      doc.text(
        "Additional deductions from calculators (for example QBI, home office, mileage) are included in the totals above and in the sections that follow.",
        20,
        finalY + 8,
      );
    }

    // Build Schedule C / SE / Category sections that mirror on-page cards

    // Schedule C section
    if (includeScheduleC) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Schedule C — Profit or Loss (summary)", 20, 20);
      doc.setFontSize(10);
      doc.text(
        "Line-by-line expense totals to copy onto the Schedule C expense section.",
        20,
        27,
      );

      const scheduleCRows = SCHEDULE_C_LINES.map((l) => {
        const amt = summary.lineBreakdown[l.line] ?? 0;
        if (!amt || amt <= 0) return null;
        return [l.line, l.label, `$${amt.toFixed(2)}`];
      }).filter(Boolean) as string[][];

      if (scheduleCRows.length > 0) {
        autoTable(doc, {
          startY: 34,
          head: [["Line", "Description", "Amount"]],
          body: scheduleCRows,
          theme: "striped",
          headStyles: { fillColor: [63, 81, 71] },
        });
      } else {
        doc.setFontSize(10);
        doc.text("No deductible Schedule C expenses for this period.", 20, 34);
      }
    }

    // Schedule SE section
    if (includeScheduleSE) {
      doc.addPage();
      const se = calculateScheduleSE(summary.netProfit);

      doc.setFontSize(16);
      doc.text("Schedule SE — Self-Employment Tax (summary)", 20, 20);
      doc.setFontSize(10);
      doc.text(
        "These figures line up with the Schedule SE worksheet: net earnings, Social Security and Medicare tax, and the deductible half.",
        20,
        27,
      );

      const seLines: string[][] = [
        ["Net earnings from self-employment", `$${se.netEarnings.toFixed(2)}`],
        ["Social Security tax (12.4%)", `$${se.socialSecurityTax.toFixed(2)}`],
        ["Medicare tax (2.9%)", `$${se.medicareTax.toFixed(2)}`],
        ["Total SE tax", `$${se.totalSETax.toFixed(2)}`],
        ["Deductible half of SE tax", `$${(se.totalSETax / 2).toFixed(2)}`],
      ];

      autoTable(doc, {
        startY: 34,
        head: [["Item", "Amount"]],
        body: seLines,
        theme: "striped",
        headStyles: { fillColor: [63, 81, 71] },
      });
    }

    // Category breakdown section
    if (includeCategories) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text("Category breakdown (deductible expenses)", 20, 20);
      doc.setFontSize(10);
      doc.text(
        "Matches the Category Breakout card — helpful for your tax preparer or bookkeeping software.",
        20,
        27,
      );

      const categoryEntries = Object.entries(summary.categoryBreakdown)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => (b as number) - (a as number));

      if (categoryEntries.length > 0) {
        const categoryRows = categoryEntries.map(([name, amt]) => [
          name,
          `$${(amt as number).toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY: 34,
          head: [["Category", "Amount"]],
          body: categoryRows,
          theme: "striped",
          headStyles: { fillColor: [63, 81, 71] },
        });
      } else {
        doc.setFontSize(10);
        doc.text("No deductible expense categories for this period.", 20, 34);
      }
    }

    // Audit-ready transaction list: only deductible expenses with an explicit audit reason
    if (includeAuditOnly) {
      const deductible = filterDeductibleTransactions(quarterFilteredTx as any) as TxRecord[];
      const auditTx = deductible.filter((t) => {
        const reason = (t.business_purpose ?? "").toString().trim();
        return reason.length > 0;
      });

      if (auditTx.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text("Audit-ready transaction list", 20, 20);
        doc.setFontSize(10);
        doc.text(
          "Includes only expense transactions with a non-zero deduction and a written audit reason/business purpose.",
          20,
          27,
        );

        const auditRows = auditTx.map((t) => [
          String(t.date),
          String(t.vendor).slice(0, 22),
          `$${Number(t.amount).toFixed(2)}`,
          String(t.category ?? "").slice(0, 16),
          `${(t.deduction_percent ?? 100).toFixed(0)}%`,
          String(t.business_purpose ?? "").slice(0, 80),
        ]);

        autoTable(doc, {
          startY: 34,
          head: [["Date", "Vendor", "Amount", "Category", "Deduction", "Audit reason"]],
          body: auditRows,
          theme: "striped",
          headStyles: { fillColor: [63, 81, 71] },
          styles: { fontSize: 8 },
        });
      }
    }

    const buf = Buffer.from(doc.output("arraybuffer"));
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="tax-deductions-${taxYear}.pdf"`,
      },
    });
  }

  return NextResponse.json(
    { error: "Use ?format=csv or ?format=pdf" },
    { status: 400 }
  );
}
