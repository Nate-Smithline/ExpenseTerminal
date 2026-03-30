import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, expensiveOpLimit } from "@/lib/middleware/rate-limit";
import {
  calculateTaxSummary,
  calculateScheduleSE,
  filterDeductibleTransactions,
} from "@/lib/tax/form-calculations";
import { SCHEDULE_C_LINES } from "@/lib/tax/schedule-c-lines";
import {
  SCHEDULE_C_FIELD_MAP,
  SCHEDULE_SE_FIELD_MAP,
  FORM_8829_FIELD_MAP,
  FORM_4562_FIELD_MAP,
  SCHEDULE_C_HEADER_FIELDS,
} from "@/lib/tax/irs-form-mappings";

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

type Override = {
  form_type: string;
  line_key: string;
  original_value: string | null;
  override_value: string;
};

type DeductionRow = {
  type: string;
  amount: string | number;
  metadata?: Record<string, unknown> | null;
};

function fmt(n: number): string {
  return n.toFixed(2);
}

async function fillIRSPdf(
  pdfBytes: Uint8Array,
  fieldValues: Record<string, string>,
  flatten: boolean
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();

  for (const [fieldName, value] of Object.entries(fieldValues)) {
    try {
      const field = form.getTextField(fieldName);
      field.setText(value);
    } catch {
      // Field not found — leave blank rather than failing
    }
  }

  if (flatten) {
    form.flatten();
  }

  return doc.save();
}

function buildScheduleCValues(
  lineBreakdown: Record<string, number>,
  grossIncome: number,
  totalExpenses: number,
  netProfit: number,
  homeOfficeDeduction: number,
  overrides: Override[]
): Record<string, string> {
  const values: Record<string, string> = {};
  const overrideMap = new Map(
    overrides
      .filter((o) => o.form_type === "schedule_c")
      .map((o) => [o.line_key, Number(o.override_value)])
  );

  values[SCHEDULE_C_FIELD_MAP.find((f) => f.lineKey === "1")!.pdfFieldName] = fmt(
    overrideMap.get("1") ?? grossIncome
  );

  for (const mapping of SCHEDULE_C_FIELD_MAP) {
    if (mapping.lineKey === "1" || mapping.lineKey === "28" || mapping.lineKey === "29" || mapping.lineKey === "30" || mapping.lineKey === "31") {
      continue;
    }
    const computed = lineBreakdown[mapping.lineKey] ?? 0;
    const val = overrideMap.get(mapping.lineKey) ?? computed;
    if (val > 0) {
      values[mapping.pdfFieldName] = fmt(val);
    }
  }

  values[SCHEDULE_C_FIELD_MAP.find((f) => f.lineKey === "28")!.pdfFieldName] = fmt(
    overrideMap.get("28") ?? totalExpenses
  );
  values[SCHEDULE_C_FIELD_MAP.find((f) => f.lineKey === "29")!.pdfFieldName] = fmt(
    overrideMap.get("29") ?? (grossIncome - totalExpenses)
  );
  if (homeOfficeDeduction > 0) {
    values[SCHEDULE_C_FIELD_MAP.find((f) => f.lineKey === "30")!.pdfFieldName] = fmt(
      overrideMap.get("30") ?? homeOfficeDeduction
    );
  }
  values[SCHEDULE_C_FIELD_MAP.find((f) => f.lineKey === "31")!.pdfFieldName] = fmt(
    overrideMap.get("31") ?? netProfit
  );

  return values;
}

function buildScheduleSEValues(
  netProfit: number,
  overrides: Override[]
): Record<string, string> {
  const se = calculateScheduleSE(netProfit);
  const overrideMap = new Map(
    overrides
      .filter((o) => o.form_type === "schedule_se")
      .map((o) => [o.line_key, Number(o.override_value)])
  );

  const values: Record<string, string> = {};
  const fieldMap: Record<string, number> = {
    se_net_profit: overrideMap.get("se_net_profit") ?? netProfit,
    se_92_35: overrideMap.get("se_92_35") ?? se.netEarnings,
    se_ss_tax: overrideMap.get("se_ss_tax") ?? se.socialSecurityTax,
    se_medicare_tax: overrideMap.get("se_medicare_tax") ?? se.medicareTax,
    se_total: overrideMap.get("se_total") ?? se.totalSETax,
    se_deductible_half: overrideMap.get("se_deductible_half") ?? se.deductibleHalf,
  };

  for (const mapping of SCHEDULE_SE_FIELD_MAP) {
    const val = fieldMap[mapping.lineKey];
    if (val != null && val !== 0) {
      values[mapping.pdfFieldName] = fmt(val);
    }
  }

  return values;
}

function buildForm8829Values(
  deductions: DeductionRow[],
  overrides: Override[]
): Record<string, string> | null {
  const homeOffice = deductions.find((d) => d.type === "home_office");
  if (!homeOffice) return null;

  const meta = (homeOffice.metadata ?? {}) as Record<string, unknown>;
  const overrideMap = new Map(
    overrides
      .filter((o) => o.form_type === "form_8829")
      .map((o) => [o.line_key, Number(o.override_value)])
  );

  const values: Record<string, string> = {};
  const sqFt = Number(meta.square_feet ?? 0);
  const totalArea = Number(meta.total_area ?? meta.home_value ?? 0);
  const pct = Number(meta.business_pct ?? 0);
  const deduction = Math.abs(Number(homeOffice.amount));

  for (const mapping of FORM_8829_FIELD_MAP) {
    let val: number | undefined;
    switch (mapping.lineKey) {
      case "8829_sqft_business":
        val = overrideMap.get("8829_sqft_business") ?? sqFt;
        break;
      case "8829_sqft_total":
        val = overrideMap.get("8829_sqft_total") ?? totalArea;
        break;
      case "8829_pct":
        val = overrideMap.get("8829_pct") ?? pct;
        break;
      case "8829_deduction":
        val = overrideMap.get("8829_deduction") ?? deduction;
        break;
    }
    if (val != null && val > 0) {
      values[mapping.pdfFieldName] = mapping.lineKey === "8829_pct" ? val.toFixed(1) : fmt(val);
    }
  }

  return Object.keys(values).length > 0 ? values : null;
}

function buildForm4562Values(
  deductions: DeductionRow[],
  overrides: Override[]
): Record<string, string> | null {
  const mileage = deductions.find((d) => d.type === "mileage");
  const vehicle = deductions.find((d) => d.type === "vehicle_expenses");
  if (!mileage && !vehicle) return null;

  const overrideMap = new Map(
    overrides
      .filter((o) => o.form_type === "form_4562")
      .map((o) => [o.line_key, Number(o.override_value)])
  );

  const values: Record<string, string> = {};
  const deduction = Math.abs(Number((mileage ?? vehicle)!.amount));

  const deductionField = FORM_4562_FIELD_MAP.find((f) => f.lineKey === "4562_deduction");
  if (deductionField) {
    values[deductionField.pdfFieldName] = fmt(overrideMap.get("4562_deduction") ?? deduction);
  }

  // TODO: Vehicle Form 4562 structured data — populate total_miles, business_miles,
  // business_pct when the mileage calculator stores structured metadata.

  return Object.keys(values).length > 0 ? values : null;
}

function buildTransactionCsv(transactions: TxRecord[]): string {
  const headers = [
    "Type",
    "Date",
    "Vendor",
    "Amount",
    "Category",
    "Schedule C Line",
    "Deduction %",
    "Business Purpose",
    "Notes",
  ];
  const rows = transactions.map((t) => [
    t.transaction_type ?? "expense",
    t.date,
    t.vendor ?? "",
    t.amount,
    t.category ?? "",
    t.schedule_c_line ?? "",
    String(t.deduction_percent ?? 100),
    t.business_purpose ?? "",
    t.notes ?? "",
  ]);
  const escape = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  return [
    headers.join(","),
    ...rows.map((r) => r.map(escape).join(",")),
  ].join("\n");
}

async function buildCoverSheetPdf(
  taxYear: number,
  isCpaPacket: boolean,
  summary: {
    grossIncome: number;
    totalExpenses: number;
    netProfit: number;
    selfEmploymentTax: number;
    categoryBreakdown: Record<string, number>;
    lineBreakdown: Record<string, number>;
  },
  overrides: Override[],
  orgSettings: { business_name?: string; filing_type?: string; business_industry?: string } | null
): Promise<Uint8Array> {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text(
    isCpaPacket ? `${taxYear} CPA Review Packet` : `${taxYear} Tax Filing Package`,
    20,
    20
  );

  doc.setFontSize(10);
  doc.text("Prepared by ExpenseTerminal", 20, 28);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-US")}`, 20, 34);

  let y = 44;

  if (isCpaPacket) {
    doc.setFontSize(12);
    doc.text("CPA Cover Memo", 20, y);
    y += 8;
    doc.setFontSize(10);

    const lines = [
      `Business: ${orgSettings?.business_name ?? "Not specified"}`,
      `Industry: ${orgSettings?.business_industry ?? "Not specified"}`,
      `Filing type: ${orgSettings?.filing_type ?? "Sole Proprietor"}`,
      "",
      `Gross income: $${summary.grossIncome.toFixed(2)}`,
      `Total claimed deductions: $${summary.totalExpenses.toFixed(2)}`,
      `Net profit: $${summary.netProfit.toFixed(2)}`,
      `Self-employment tax: $${summary.selfEmploymentTax.toFixed(2)}`,
      "",
      "Methodology: Deductions are sourced from bank transaction imports,",
      "categorized by AI with user review. Each transaction is mapped to a",
      "Schedule C line. Meals are subject to the 50% limitation.",
    ];

    for (const line of lines) {
      doc.text(line, 20, y);
      y += 5;
    }

    if (overrides.length > 0) {
      y += 4;
      doc.setFontSize(11);
      doc.text("Manual Overrides", 20, y);
      y += 6;

      const overrideRows = overrides.map((o) => [
        `${o.form_type} / ${o.line_key}`,
        o.original_value != null ? `$${Number(o.original_value).toFixed(2)}` : "—",
        `$${Number(o.override_value).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: y,
        head: [["Line", "Computed Value", "Override Value"]],
        body: overrideRows,
        theme: "striped",
        headStyles: { fillColor: [63, 81, 71] },
      });
    }
  } else {
    doc.setFontSize(10);
    doc.text("This package contains your pre-filled IRS forms and a transaction summary.", 20, y);
    y += 6;
    doc.text("Review each form carefully before filing. Values are based on your", 20, y);
    y += 5;
    doc.text("categorized transactions in ExpenseTerminal.", 20, y);
    y += 10;

    if (overrides.length > 0) {
      doc.text(`Note: ${overrides.length} value(s) were manually overridden and are flagged in the forms.`, 20, y);
      y += 10;
    }

    doc.setFontSize(12);
    doc.text("Package Contents", 20, y);
    y += 7;
    doc.setFontSize(10);
    const contents = [
      "1. Schedule C (Form 1040) — Profit or Loss From Business",
      "2. Schedule SE (Form 1040) — Self-Employment Tax",
      "3. Form 8829 — Business Use of Home (if applicable)",
      "4. Form 4562 — Vehicle Depreciation (if applicable)",
      "5. Transaction Summary (CSV)",
      "6. This cover sheet",
    ];
    for (const line of contents) {
      doc.text(line, 24, y);
      y += 5;
    }
  }

  if (isCpaPacket) {
    doc.addPage();
    doc.setFontSize(14);
    doc.text("Deduction Breakdown by Category", 20, 20);
    doc.setFontSize(10);

    const categoryEntries = Object.entries(summary.categoryBreakdown)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a);

    if (categoryEntries.length > 0) {
      autoTable(doc, {
        startY: 28,
        head: [["Category", "Amount"]],
        body: categoryEntries.map(([name, amt]) => [name, `$${amt.toFixed(2)}`]),
        theme: "striped",
        headStyles: { fillColor: [63, 81, 71] },
      });
    }

    const lastTable = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
    let lineY = (lastTable?.finalY ?? 28) + 14;

    doc.setFontSize(14);
    doc.text("Schedule C Line Breakdown", 20, lineY);
    lineY += 8;

    const lineRows = SCHEDULE_C_LINES.map((l) => {
      const amt = summary.lineBreakdown[l.line] ?? 0;
      if (amt <= 0) return null;
      return [l.line, l.label, `$${amt.toFixed(2)}`];
    }).filter(Boolean) as string[][];

    if (lineRows.length > 0) {
      autoTable(doc, {
        startY: lineY,
        head: [["Line", "Description", "Amount"]],
        body: lineRows,
        theme: "striped",
        headStyles: { fillColor: [63, 81, 71] },
      });
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
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
  const exportType = searchParams.get("type") ?? "self_file";
  const taxYear = parseInt(searchParams.get("tax_year") || String(new Date().getFullYear()), 10);
  const isCpaPacket = exportType === "cpa_packet";
  const flatten = !isCpaPacket;

  const { data: transactions } = await (supabase as any)
    .from("transactions")
    .select(
      "id,vendor,amount,date,status,transaction_type,schedule_c_line,category,is_meal,is_travel,deduction_percent,quick_label,business_purpose,notes"
    )
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .in("status", ["completed", "auto_sorted"])
    .order("date", { ascending: false });

  const { data: deductions } = await (supabase as any)
    .from("deductions")
    .select("type,amount,tax_savings,metadata")
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  const { data: taxSettings } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", taxYear)
    .single();

  const { data: orgSettings } = await (supabase as any)
    .from("org_settings")
    .select("business_name,filing_type,business_industry,ein,business_address_line1,business_city,business_state,business_zip")
    .eq("user_id", userId)
    .single();

  const { data: overridesData } = await (supabase as any)
    .from("tax_filing_overrides")
    .select("form_type,line_key,original_value,override_value")
    .eq("user_id", userId)
    .eq("tax_year", taxYear);

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("display_name,first_name,last_name")
    .eq("id", userId)
    .single();

  const taxRate = taxSettings?.tax_rate ? Number(taxSettings.tax_rate) : 0.24;
  const allTx = (transactions ?? []) as TxRecord[];
  const deductionsList = (deductions ?? []) as DeductionRow[];
  const overrides = (overridesData ?? []) as Override[];

  const summary = calculateTaxSummary(
    allTx,
    deductionsList.map((d) => ({ type: d.type, amount: d.amount })),
    taxRate
  );

  const homeOfficeDeduction = Math.abs(
    Number(deductionsList.find((d) => d.type === "home_office")?.amount ?? 0)
  );

  const scheduleCValues = buildScheduleCValues(
    summary.lineBreakdown,
    summary.grossIncome,
    summary.totalExpenses,
    summary.netProfit,
    homeOfficeDeduction,
    overrides
  );

  if (orgSettings) {
    if (orgSettings.business_name) {
      scheduleCValues[SCHEDULE_C_HEADER_FIELDS.businessName] = orgSettings.business_name;
    }
    if (orgSettings.ein) {
      scheduleCValues[SCHEDULE_C_HEADER_FIELDS.ein] = orgSettings.ein;
    }
    const addrParts = [
      orgSettings.business_address_line1,
      orgSettings.business_city,
      orgSettings.business_state,
      orgSettings.business_zip,
    ].filter(Boolean);
    if (addrParts.length > 0) {
      scheduleCValues[SCHEDULE_C_HEADER_FIELDS.businessAddress] = addrParts.join(", ");
    }
    if (orgSettings.business_industry) {
      scheduleCValues[SCHEDULE_C_HEADER_FIELDS.principalBusinessActivity] =
        orgSettings.business_industry;
    }
  }

  const scheduleSEValues = buildScheduleSEValues(summary.netProfit, overrides);
  const form8829Values = buildForm8829Values(deductionsList, overrides);
  const form4562Values = buildForm4562Values(deductionsList, overrides);

  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();

  // IRS PDF filling — use placeholder empty PDFs since we can't bundle actual IRS PDFs.
  // In production, fetch or bundle the real IRS fillable PDFs.
  // For now, generate summary PDFs with jsPDF as a fallback.
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  // Schedule C summary PDF
  {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Schedule C — Profit or Loss From Business (${taxYear})`, 20, 20);
    doc.setFontSize(9);
    doc.text(
      "Pre-filled values from ExpenseTerminal. Transfer these to the official IRS Schedule C form.",
      20,
      27
    );

    const rows = SCHEDULE_C_LINES.map((l) => {
      const computed = summary.lineBreakdown[l.line] ?? 0;
      const override = overrides.find(
        (o) => o.form_type === "schedule_c" && o.line_key === l.line
      );
      const val = override ? Number(override.override_value) : computed;
      if (val <= 0 && !override) return null;
      return [
        `Line ${l.line}`,
        l.label,
        `$${val.toFixed(2)}`,
        override ? "OVERRIDE" : "",
      ];
    }).filter(Boolean) as string[][];

    rows.unshift(["Line 1", "Gross receipts", `$${summary.grossIncome.toFixed(2)}`, ""]);
    rows.push(["Line 28", "Total expenses", `$${summary.totalExpenses.toFixed(2)}`, ""]);
    rows.push(["Line 31", "Net profit", `$${summary.netProfit.toFixed(2)}`, ""]);

    autoTable(doc, {
      startY: 34,
      head: [["Line", "Description", "Amount", "Status"]],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 71] },
    });

    zip.file("Schedule_C.pdf", Buffer.from(doc.output("arraybuffer")));
  }

  // Schedule SE summary PDF
  {
    const se = calculateScheduleSE(summary.netProfit);
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Schedule SE — Self-Employment Tax (${taxYear})`, 20, 20);
    doc.setFontSize(9);
    doc.text(
      "Pre-filled values from ExpenseTerminal. Transfer these to the official IRS Schedule SE form.",
      20,
      27
    );

    const seRows = [
      ["Net earnings from self-employment", `$${se.netEarnings.toFixed(2)}`],
      ["Social Security tax (12.4%)", `$${se.socialSecurityTax.toFixed(2)}`],
      ["Medicare tax (2.9%)", `$${se.medicareTax.toFixed(2)}`],
      ["Total SE tax", `$${se.totalSETax.toFixed(2)}`],
      ["Deductible half of SE tax", `$${se.deductibleHalf.toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 34,
      head: [["Item", "Amount"]],
      body: seRows,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 71] },
    });

    zip.file("Schedule_SE.pdf", Buffer.from(doc.output("arraybuffer")));
  }

  // Form 8829 (if applicable)
  if (form8829Values) {
    const homeOffice = deductionsList.find((d) => d.type === "home_office");
    const meta = (homeOffice?.metadata ?? {}) as Record<string, unknown>;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Form 8829 — Business Use of Home (${taxYear})`, 20, 20);
    doc.setFontSize(9);
    doc.text(
      "Pre-filled values from ExpenseTerminal. Transfer these to the official IRS Form 8829.",
      20,
      27
    );

    const rows8829 = [
      ["Business square footage", `${Number(meta.square_feet ?? 0)}`],
      ["Total home area", `${Number(meta.total_area ?? meta.home_value ?? 0)}`],
      ["Business use percentage", `${Number(meta.business_pct ?? 0)}%`],
      ["Home office deduction", `$${Math.abs(Number(homeOffice?.amount ?? 0)).toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 34,
      head: [["Item", "Value"]],
      body: rows8829,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 71] },
    });

    zip.file("Form_8829.pdf", Buffer.from(doc.output("arraybuffer")));
  }

  // Form 4562 (if applicable)
  if (form4562Values) {
    const mileage = deductionsList.find((d) => d.type === "mileage");
    const vehicle = deductionsList.find((d) => d.type === "vehicle_expenses");
    const source = mileage ?? vehicle;
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text(`Form 4562 — Vehicle Deduction (${taxYear})`, 20, 20);
    doc.setFontSize(9);
    doc.text(
      "Pre-filled values from ExpenseTerminal. Transfer these to the official IRS Form 4562.",
      20,
      27
    );

    const rows4562 = [
      ["Vehicle deduction", `$${Math.abs(Number(source?.amount ?? 0)).toFixed(2)}`],
    ];

    autoTable(doc, {
      startY: 34,
      head: [["Item", "Value"]],
      body: rows4562,
      theme: "striped",
      headStyles: { fillColor: [63, 81, 71] },
    });

    zip.file("Form_4562.pdf", Buffer.from(doc.output("arraybuffer")));
  }

  // Transaction summary CSV
  const deductible = filterDeductibleTransactions(allTx as any) as TxRecord[];
  zip.file("Transaction_Summary.csv", buildTransactionCsv(deductible));

  // Cover sheet / CPA memo
  const coverPdf = await buildCoverSheetPdf(
    taxYear,
    isCpaPacket,
    summary,
    overrides,
    orgSettings
  );
  zip.file(isCpaPacket ? "CPA_Cover_Memo.pdf" : "Cover_Sheet.pdf", coverPdf);

  const zipArrayBuffer = await zip.generateAsync({ type: "arraybuffer" });

  const userName =
    profile?.display_name ||
    [profile?.first_name, profile?.last_name].filter(Boolean).join("_") ||
    "User";
  const safeName = userName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const suffix = isCpaPacket ? "CPAPacket" : "SelfFile";
  const filename = `${safeName}_TaxForms_${taxYear}_${suffix}.zip`;

  return new NextResponse(Buffer.from(zipArrayBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
