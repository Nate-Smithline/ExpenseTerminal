export function vendorPromptKey(
  vendorNormalized: string,
  transactionType: "income" | "expense",
): string {
  return `${vendorNormalized.toLowerCase().trim()}:${transactionType}`;
}

export function ruleTransactionType(conditions: unknown): "income" | "expense" {
  const tt = (conditions as { transaction_type?: string } | null)?.transaction_type;
  return tt === "income" ? "income" : "expense";
}
