function normalize(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function matchesTravelProfileName(name: string | null, query: string) {
  const normalizedName = normalize(name ?? "");
  const normalizedQuery = normalize(query);
  if (!normalizedName || !normalizedQuery) return false;
  return [
    normalizedName,
    `${normalizedName} travel`,
    `${normalizedName} travel prefs`,
    `${normalizedName} travel preferences`,
    `${normalizedName} travel portal`,
  ].some((alias) => alias.includes(normalizedQuery));
}
