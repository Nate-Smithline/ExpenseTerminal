/** Three search-oriented tags derived from the Material Symbol ligature name. */
export function materialIconTags(name: string): string[] {
  const parts = name
    .split("_")
    .map((p) => p.trim())
    .filter((p) => p.length > 0 && !/^\d+$/.test(p));

  const tags: string[] = [];
  for (const p of parts) {
    if (tags.length >= 3) break;
    if (!tags.includes(p)) tags.push(p);
  }
  if (tags.length === 0) tags.push(name);
  while (tags.length < 3) {
    tags.push(tags[tags.length - 1] ?? name);
  }
  return tags.slice(0, 3);
}

export function materialIconSearchBlob(name: string): string {
  return [name, ...materialIconTags(name)].join(" ").toLowerCase();
}
