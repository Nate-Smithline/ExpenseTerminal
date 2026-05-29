export function sortBudgetLines<T extends { id: string; position: number }>(lines: readonly T[]): T[] {
  return [...lines].sort((a, b) => {
    if (a.position !== b.position) return a.position - b.position;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function sortBudgetGroups<
  T extends { position: number; budget_lines?: readonly { id: string; position: number }[] },
>(groups: T[]): T[] {
  return [...groups]
    .sort((a, b) => a.position - b.position)
    .map((g) => ({
      ...g,
      budget_lines: sortBudgetLines([...(g.budget_lines ?? [])]),
    })) as T[];
}

/**
 * Move a line to `toIndex` within `toGroupId` (reorders positions 0..n-1).
 * Returns line id → { budget_group_id, position } updates for every affected line.
 */
export function planLineMove(
  groups: {
    id: string;
    kind?: string;
    budget_lines: { id: string; position: number }[];
  }[],
  lineId: string,
  toGroupId: string,
  toIndex: number
): { updates: { id: string; budget_group_id: string; position: number }[]; error?: string } {
  let sourceGroupId: string | null = null;
  let sourceKind: string | undefined;
  let targetKind: string | undefined;
  let movingLine: { id: string; position: number } | null = null;

  for (const g of groups) {
    if (g.id === toGroupId) targetKind = g.kind ?? "expense";
    const found = g.budget_lines.find((l) => l.id === lineId);
    if (found) {
      sourceGroupId = g.id;
      sourceKind = g.kind ?? "expense";
      movingLine = found;
    }
  }

  if (!movingLine || !sourceGroupId) {
    return { updates: [], error: "Line not found" };
  }
  if (!targetKind) {
    return { updates: [], error: "Target group not found" };
  }
  if (sourceKind !== targetKind) {
    return { updates: [], error: "Can only move lines between groups of the same type (income or expense)" };
  }

  const byGroup = new Map<string, { id: string; position: number }[]>();
  for (const g of groups) {
    byGroup.set(
      g.id,
      sortBudgetLines(g.budget_lines).filter((l) => l.id !== lineId)
    );
  }

  const targetLines = byGroup.get(toGroupId) ?? [];
  const clampedIndex = Math.max(0, Math.min(toIndex, targetLines.length));
  targetLines.splice(clampedIndex, 0, movingLine);
  byGroup.set(toGroupId, targetLines);

  const affectedGroupIds =
    sourceGroupId === toGroupId ? [toGroupId] : [sourceGroupId, toGroupId];

  const updates: { id: string; budget_group_id: string; position: number }[] = [];
  for (const groupId of affectedGroupIds) {
    const lines = byGroup.get(groupId) ?? [];
    lines.forEach((line, index) => {
      updates.push({
        id: line.id,
        budget_group_id: groupId,
        position: index,
      });
    });
  }

  return { updates };
}
