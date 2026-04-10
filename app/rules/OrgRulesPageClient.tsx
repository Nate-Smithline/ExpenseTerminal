"use client";

/**
 * Temporary shell so `/rules` renders on partial branches.
 * Replace with full OrgRulesPageClient when merging from main.
 */
export function OrgRulesPageClient({
  initialRules,
  initialProperties,
}: {
  initialRules: unknown[];
  initialProperties: unknown[];
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-3 px-5 py-10">
      <h1 className="font-display text-2xl font-normal text-mono-dark">Automations</h1>
      <p className="text-[13px] leading-relaxed text-mono-medium">
        The rules editor UI isn&apos;t on this branch yet. Your data is loaded server-side (
        {initialRules.length} rules, {initialProperties.length} properties).
      </p>
    </div>
  );
}
