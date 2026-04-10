"use client";

/**
 * Temporary shell for `/preferences/org`.
 * Replace with full workspace settings UI when merging from main.
 */
export function OrgPreferencesClient({
  currentUserId: _currentUserId,
  initialOrg,
  initialMembers,
}: {
  currentUserId: string;
  initialOrg: { id: string; name: string; role: string };
  initialMembers: unknown[];
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-5 py-10">
      <h1 className="font-display text-2xl font-normal text-mono-dark">Workspace</h1>
      <p className="text-[15px] font-medium text-mono-dark">{initialOrg.name}</p>
      <p className="text-[13px] text-mono-medium">
        Role: <span className="font-medium">{initialOrg.role}</span>
      </p>
      <p className="text-[13px] leading-relaxed text-mono-light">
        Full org preferences UI isn&apos;t on this branch yet. {initialMembers.length} member(s) loaded.
      </p>
    </div>
  );
}
