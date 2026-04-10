/**
 * Enrich org member rows (e.g. invitee emails from auth).
 * Passthrough stub — server page already loads profiles when available.
 */
export async function enrichOrgMemberRows<T>(rows: T[]): Promise<T[]> {
  return rows;
}
