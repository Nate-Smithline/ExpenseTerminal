import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/middleware/auth";
import { rateLimitForRequest, generalApiLimit } from "@/lib/middleware/rate-limit";
import { safeErrorMessage } from "@/lib/api/safe-error";
import { deductionComputeSchema } from "@/lib/validation/schemas";
import {
  calculateHomeOffice,
  calculateMileageDeduction,
  calculatePercentageBasedAnnual,
  mileageRateForYear,
  type CalculatedDeductionMetadata,
} from "@/lib/calculations/calculated-deductions";
import { requireWorkspaceIdForApi } from "@/lib/workspaces/server";

/**
 * Compute derived deduction amounts server-side and upsert `deductions` row.
 * Aligns with docs/plans.md calculated deduction engine.
 */
export async function POST(req: Request) {
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
  const wsRes = await requireWorkspaceIdForApi(supabase as any, userId, req);
  if ("error" in wsRes) {
    return NextResponse.json({ error: wsRes.error }, { status: wsRes.status });
  }
  const workspaceId = wsRes.workspaceId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const parsed = deductionComputeSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.flatten().formErrors[0] ?? "Invalid request body";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  const input = parsed.data;

  const { data: taxYearRow } = await (supabase as any)
    .from("tax_year_settings")
    .select("tax_rate")
    .eq("user_id", userId)
    .eq("tax_year", input.tax_year)
    .single();

  const taxRate = taxYearRow?.tax_rate != null ? Number(taxYearRow.tax_rate) : 0.24;

  let annualAmount = 0;
  let meta: CalculatedDeductionMetadata = { computedAt: new Date().toISOString() };

  switch (input.type) {
    case "home_office": {
      const ho = calculateHomeOffice({
        workspaceSqFt: input.workspace_sq_ft,
        totalHomeSqFt: input.total_home_sq_ft,
        monthlyRent: input.monthly_rent,
        monthlyUtilities: input.monthly_utilities ?? 0,
        year: input.tax_year,
      });
      annualAmount = ho.homeOfficeAnnualDeduction;
      meta = {
        ...meta,
        home_office: {
          ...ho,
          workspaceSqFt: input.workspace_sq_ft,
          totalHomeSqFt: input.total_home_sq_ft,
          monthlyRent: input.monthly_rent,
          monthlyUtilities: input.monthly_utilities ?? 0,
        },
      };
      break;
    }
    case "mileage": {
      const rate = mileageRateForYear(input.tax_year);
      const mileageAnnualDeduction = calculateMileageDeduction(input.miles, input.tax_year);
      annualAmount = mileageAnnualDeduction;
      meta = {
        ...meta,
        mileage: { miles: input.miles, irsRatePerMile: rate, mileageAnnualDeduction },
      };
      break;
    }
    case "phone":
    case "internet": {
      const pct = calculatePercentageBasedAnnual(input.monthly_bill_amount, input.business_use_percent);
      annualAmount = pct;
      meta = {
        ...meta,
        percentage: {
          monthlyBillAmount: input.monthly_bill_amount,
          businessUsePercent: input.business_use_percent,
          percentageAnnualDeduction: pct,
        },
      };
      break;
    }
    case "health_insurance":
    case "retirement": {
      annualAmount = input.annual_amount;
      break;
    }
    case "other": {
      annualAmount = input.annual_amount;
      if (input.label) meta = { ...meta, label: input.label };
      break;
    }
    default:
      return NextResponse.json({ error: "Unsupported type" }, { status: 400 });
  }

  const taxSavings = Math.round(annualAmount * taxRate * 100) / 100;

  await (supabase as any)
    .from("deductions")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("type", input.type)
    .eq("tax_year", input.tax_year);

  const cols = "id,user_id,workspace_id,type,tax_year,amount,tax_savings,metadata,created_at";
  const { data, error } = await (supabase as any)
    .from("deductions")
    .insert({
      user_id: userId,
      workspace_id: workspaceId,
      type: input.type,
      tax_year: input.tax_year,
      amount: String(annualAmount),
      tax_savings: String(taxSavings),
      metadata: { ...meta, engine: "calculated-deductions v1" },
    })
    .select(cols)
    .single();

  if (error) {
    return NextResponse.json(
      { error: safeErrorMessage(error.message, "Failed to save deduction") },
      { status: 500 }
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/deductions");
  revalidatePath("/other-deductions");
  return NextResponse.json(data);
}
