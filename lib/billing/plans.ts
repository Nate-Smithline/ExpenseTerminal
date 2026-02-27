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
    name: "Free",
    priceHuman: "$0",
    priceInterval: "year",
    stripeProductId: null,
    description: "Try the full ExpenseTerminal flow with a focused limit on AI-reviewed transactions.",
    highlights: [
      "Inbox-first review of your business expenses",
      "CSV uploads for bank and card exports",
      "Up to 250 AI-reviewed CSV transactions per workspace",
      "Schedule C-focused categorization and notes",
    ],
    maxCsvTransactionsForAi: 250,
    aiEnabled: true,
    bankSyncIncluded: false,
  },
  starter: {
    id: "starter",
    name: "Starter",
    priceHuman: "$120",
    priceInterval: "year",
    stripeProductId: STARTER_PRODUCT_ID,
    description: "A calm, dependable tax companion for a full year of self-employment.",
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
    name: "Plus",
    priceHuman: "$300",
    priceInterval: "year",
    stripeProductId: PLUS_PRODUCT_ID,
    description: "For founders who want ExpenseTerminal woven directly into their banking.",
    highlights: [
      "Everything in Starter",
      "Live bank syncing with Stripe Financial Connections (coming soon)",
      "Deeper automation for recurring vendors",
    ],
    maxCsvTransactionsForAi: null,
    aiEnabled: true,
    bankSyncIncluded: false,
    bankSyncComingSoon: true,
  },
};

export function getPlanDefinition(id: PlanId): PlanDefinition {
  return plans[id];
}

