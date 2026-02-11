import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createSupabaseRouteClient } from "@/lib/supabase/server";
import { normalizeVendor } from "@/lib/vendor-matching";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const systemPrompt = `You are a tax expert analyzing business expenses for Schedule C (IRS Form 1040).

Your job is to:
1. Categorize the expense into the correct IRS category
2. Assign the Schedule C line number
3. Assess deductibility (likely_good, needs_review, unclear)
4. Provide concise reasoning
5. Suggest 3-4 quick-action labels the user can click
6. Identify special cases (meals, travel, etc.)

Important tax rules:
- Meals are 50% deductible, must be business-related
- Local commuting is NOT deductible
- Personal expenses are NEVER deductible
- Amazon purchases need itemization
- Equipment >$2,500 must be depreciated

Return ONLY valid JSON, no markdown.`;

function buildUserPrompt(t: {
  vendor: string;
  amount: number;
  description?: string;
  date: string;
}) {
  return `
Analyze this transaction:

Vendor: ${t.vendor}
Amount: $${Math.abs(t.amount)}
Description: ${t.description || "N/A"}
Date: ${t.date}

Return JSON:
{
  "category": "Meals" | "Travel" | "Supplies" | "Insurance" | "Other expenses" | etc,
  "scheduleCLine": "Line 24b" | "Line 22" | etc,
  "status": "likely_good" | "needs_review" | "unclear",
  "confidence": 0.85,
  "reasoning": "Brief 1-sentence explanation",
  "isMeal": true | false,
  "isTravel": true | false,
  "suggestions": [
    "Business Meal",
    "Client Dinner",
    "Team Lunch",
    "Personal"
  ]
}
`;
}

type IncomingRow = {
  date: string;
  vendor: string;
  description?: string;
  amount: number;
};

export async function POST(req: Request) {
  const supabase = createSupabaseRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    rows: IncomingRow[];
    taxYear: number;
  };

  if (!body.rows || !Array.isArray(body.rows) || !body.rows.length) {
    return NextResponse.json(
      { error: "No rows provided" },
      { status: 400 }
    );
  }

  const taxYear = body.taxYear || new Date().getFullYear();

  // 1. Insert transactions
  const inserts = body.rows.map((row) => ({
    user_id: user.id,
    date: new Date(row.date).toISOString().slice(0, 10),
    vendor: row.vendor,
    description: row.description ?? null,
    amount: row.amount,
    status: "pending",
    tax_year: taxYear,
    source: "csv_upload",
    vendor_normalized: normalizeVendor(row.vendor),
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("transactions")
    .insert(inserts)
    .select("*");

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to insert transactions" },
      { status: 500 }
    );
  }

  // 2. Batch process with Claude
  if (!process.env.ANTHROPIC_API_KEY) {
    // If no API key configured, skip AI but still succeed.
    return NextResponse.json({
      imported: inserted.length,
      aiProcessed: 0,
      needsReview: inserted.length,
    });
  }

  const batchSize = 20;
  let successful = 0;

  for (let i = 0; i < inserted.length; i += batchSize) {
    const batch = inserted.slice(i, i + batchSize);

    // Process in parallel within the batch
    await Promise.all(
      batch.map(async (t) => {
        try {
          const message = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 512,
            system: systemPrompt,
            messages: [
              {
                role: "user",
                content: buildUserPrompt({
                  vendor: t.vendor,
                  amount: Number(t.amount),
                  description: t.description ?? undefined,
                  date: t.date,
                }),
              },
            ],
          });

          const first = message.content[0];
          if (!first || first.type !== "text") return;

          const parsed = JSON.parse(first.text) as {
            category: string;
            scheduleCLine: string;
            status: string;
            confidence: number;
            reasoning: string;
            isMeal: boolean;
            isTravel: boolean;
            suggestions: string[];
          };

          await supabase
            .from("transactions")
            .update({
              category: parsed.category,
              schedule_c_line: parsed.scheduleCLine,
              ai_confidence: parsed.confidence,
              ai_reasoning: parsed.reasoning,
              ai_suggestions: parsed.suggestions,
              is_meal: parsed.isMeal,
              is_travel: parsed.isTravel,
              updated_at: new Date().toISOString(),
            })
            .eq("id", t.id)
            .eq("user_id", user.id);

          successful += 1;
        } catch (e) {
          console.error("Failed to categorize transaction", t.id, e);
        }
      })
    );
  }

  return NextResponse.json({
    imported: inserted.length,
    aiProcessed: successful,
    needsReview: inserted.length,
  });
}

