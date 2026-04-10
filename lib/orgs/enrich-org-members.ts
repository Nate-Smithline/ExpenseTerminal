/**
 * Enrich org member rows (e.g. invitee emails from auth).
 * Passthrough stub — server page already loads profiles when available.
 */
export type OrgMemberRow = {
  id: string;
  role: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export async function enrichOrgMemberRows(rows: OrgMemberRow[]): Promise<OrgMemberRow[]> {
  return rows;
}
