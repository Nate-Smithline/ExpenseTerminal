export function normalizeVendor(vendor: string): string {
  return vendor
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 20);
}

