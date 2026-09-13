export const referenceSorts = { "title-asc": "Title A–Z", "title-desc": "Title Z–A", newest: "Newest added", oldest: "Oldest added" } as const;
export function referenceSort(value?: string): keyof typeof referenceSorts {
  return value && Object.hasOwn(referenceSorts, value) ? value as keyof typeof referenceSorts : "title-asc";
}
