import Anthropic from "@anthropic-ai/sdk";

const MAX_CHARS = 72;

/**
 * Short IRS-style audit note for a tagged transaction (one sentence, plain language).
 */
export async function suggestAuditReason(input: {
  vendor: string;
  amount: number;
  category?: string | null;
  description?: string | null;
  marker: "Business" | "Partial" | "Personal";
  businessPct?: number;
}): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  if (input.marker === "Personal") return null;

  const client = new Anthropic({ apiKey });
  const pct =
    input.marker === "Partial" && input.businessPct != null
      ? `${input.businessPct}% business`
      : "100% business";

  const user = [
    `Vendor: ${input.vendor}`,
    `Amount: $${Math.abs(input.amount).toFixed(2)}`,
    input.category ? `Category: ${input.category}` : null,
    input.description ? `Memo: ${input.description}` : null,
    `Tag: ${input.marker} (${pct})`,
    "Write ONE short audit reason (max 12 words) explaining why this is a deductible business expense.",
    "No quotes, no vendor name repetition, no fluff.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 40,
      messages: [{ role: "user", content: user }],
    });
    const block = res.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return null;
    const text = block.text.trim().replace(/^["']|["']$/g, "");
    return text.slice(0, MAX_CHARS) || null;
  } catch {
    return null;
  }
}
