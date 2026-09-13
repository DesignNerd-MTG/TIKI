import { legacyCollectionMap, referenceCollection, validCollectionPair, collectionLabel, isReferenceTimestamp } from "./references.ts";
import { isSafeExternalUrl, normalizeTags } from "./content-validation.ts";

export type ImportRecord = {
  import_source: string; label: string; url: string; description: string; date_added: string;
  collection_id: string; subcollection_id: string | null; category: string; tags: string[];
};

export function prepareNotionImport(value: unknown) {
  if (!value || typeof value !== "object" || !("bookmarks" in value) || !Array.isArray(value.bookmarks) || value.bookmarks.length > 100) {
    throw new Error("Expected a manifest with at most 100 bookmarks.");
  }
  const records: ImportRecord[] = [];
  const issues: Array<{ label: string; reason: string }> = [];
  const seen = new Set<string>();
  let ignored = 0;
  for (const raw of value.bookmarks) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) { issues.push({ label: "Invalid row", reason: "Expected an object." }); continue; }
    const text = (key: string) => typeof raw[key] === "string" ? raw[key].trim() : "";
    const label = text("title");
    const url = text("url") || text("bookmark_url");
    if (!label && !url && !text("description")) { ignored++; continue; }
    const fail = (reason: string) => issues.push({ label: label || "Untitled", reason });
    const source = text("notion_page_id").replaceAll("-","").toLowerCase();
    if (!/^[0-9a-f]{32}$/.test(source)) { fail("Missing original Notion page ID."); continue; }
    if (seen.has(source)) { fail("Duplicate source page in manifest; skipped."); continue; }
    seen.add(source);
    if (!url || !isSafeExternalUrl(url) || url.length > 2048) { fail("Missing or invalid destination URL; export the native bookmark block. No URL inferred."); continue; }
    const date = text("created_on");
    if (!isReferenceTimestamp(date)) { fail("Missing valid original Created On timestamp with timezone."); continue; }
    const legacy = text("collection") || "Unsorted";
    const collection = legacyCollectionMap[legacy] || referenceCollection(legacy)?.id;
    const sub = text("subcollection_id");
    if (!collection || !validCollectionPair(collection,sub)) { fail("Unrecognized collection or subcollection; review explicitly."); continue; }
    if (sub && raw.subcollection_verified !== true) { fail("Subcollection needs explicit source verification."); continue; }
    const tags = Array.isArray(raw.tags) ? raw.tags : [];
    if (tags.some((tag: unknown) => typeof tag !== "string" || tag.includes(",") || tag.length > 40) || tags.length > 12) { fail("Tags require review (up to 12 names, 40 characters each, no commas)."); continue; }
    if (label.length > 160 || text("description").length > 2000) { fail("Title or description exceeds supported length."); continue; }
    records.push({ import_source: "notion:" + source, label: label || new URL(url).hostname, url,
      description: text("description"), date_added: date, collection_id: collection, subcollection_id: sub || null,
      category: collectionLabel(collection,sub), tags: normalizeTags(tags.join(",")) });
  }
  return { records, issues, ignored };
}
