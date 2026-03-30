export type PlanId = "free" | "starter" | "plus";

export interface PlanDefinition {
  id: PlanId;
  name: string;
  priceHuman: string;
  priceInterval: "year";
  stripeProductId: string | null;
  description: string;
  highlights: string[];
  maxCsvTransactionsForAi: number | null; // null = unlimited
  aiEnabled: boolean;
  bankSyncIncluded: boolean;
  bankSyncComingSoon?: boolean;
}

const STARTER_PRODUCT_ID = process.env.STRIPE_STARTER_PRODUCT_ID ?? null;
const PLUS_PRODUCT_ID = process.env.STRIPE_PLUS_PRODUCT_ID ?? null;

export const plans: Record<PlanId, PlanDefinition> = {
  free: {
    id: "free",
    name: "ExpenseTerminal",
    priceHuman: "$0",
    priceInterval: "year",
    stripeProductId: null,
    description: "The full ExpenseTerminal experience — no limits.",
    highlights: [
      "Inbox-first review of your business expenses",
      "CSV uploads for bank and card exports",
      "Unlimited AI-reviewed transactions",
      "Live bank syncing via Plaid (up to 24 months)",
      "Schedule C-focused categorization and notes",
    ],
    maxCsvTransactionsForAi: null,
    aiEnabled: true,
    bankSyncIncluded: true,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceHuman: "$120",
    priceInterval: "year",
    stripeProductId: STARTER_PRODUCT_ID,
    description: "A calm, dependable tax companion (legacy plan).",
    highlights: [
      "Unlimited AI-reviewed CSV transactions",
      "Rich Inbox workflows and keyboard shortcuts",
      "Custom tax-year settings and reporting",
      "Export-ready summaries for your accountant",
    ],
    maxCsvTransactionsForAi: null,
    aiEnabled: true,
    bankSyncIncluded: false,
  },
  plus: {
    id: "plus",
    name: "Pro",
    priceHuman: "$400",
    priceInterval: "year",
    stripeProductId: PLUS_PRODUCT_ID,
    description: "For founders who want ExpenseTerminal woven directly into their banking.",
    highlights: [
      "Unlimited AI-reviewed transactions",
      "Live bank syncing via Plaid (up to 24 months)",
      "Rich Inbox workflows and keyboard shortcuts",
      "Export-ready summaries for your accountant",
    ],
    maxCsvTransactionsForAi: null,
    aiEnabled: true,
    bankSyncIncluded: true,
  },
};

export function getPlanDefinition(id: PlanId): PlanDefinition {
  return plans[id];
}

