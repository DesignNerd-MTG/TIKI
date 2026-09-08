import { isSafeExternalUrl } from "./content-validation.ts";
import type { EntityKind } from "./types.ts";

export const additionalLinkSections = {
  fixture: [
    { key: "fixture", title: "Additional links", description: "Keep unusual fixture resources here until they earn a permanent field." },
  ],
  show: [
    { key: "show_files", title: "Additional show links", description: "General or legacy show files that are not specifically Dropbox or Egnyte." },
    { key: "show_staffing", title: "Additional staffing links", description: "Supporting crew and staffing documents beyond the primary calendar." },
  ],
} as const;

export type AdditionalLinkSection = "fixture" | "show_files" | "show_staffing";

export type AdditionalLink = {
  id?: string;
  section: AdditionalLinkSection;
  label: string;
  url: string;
  position: number;
};

export function sectionsForKind(kind: EntityKind) {
  return kind === "fixture" || kind === "show" ? additionalLinkSections[kind] : [];
}

export function validateAdditionalLinks(kind: EntityKind, links: AdditionalLink[]) {
  const allowed = new Set(sectionsForKind(kind).map((section) => section.key));
  if (!allowed.size && links.length) return { valid: false as const, message: "Additional links are not supported for this record." };
  if (links.length > 30) return { valid: false as const, message: "Use no more than 30 additional links." };

  for (const link of links) {
    if (!allowed.has(link.section)) return { valid: false as const, message: "One of the additional links is in the wrong section." };
    if (!link.label || !link.url) return { valid: false as const, message: "Every additional link needs both a label and a URL." };
    if (link.label.length > 120) return { valid: false as const, message: "Additional link labels must be 120 characters or fewer." };
    if (link.url.length > 2048 || !isSafeExternalUrl(link.url)) return { valid: false as const, message: "Use a complete http:// or https:// URL for every additional link." };
  }

  return { valid: true as const, links };
}

export function readAdditionalLinks(formData: FormData, kind: EntityKind) {
  const sections = formData.getAll("additional_link_section").map(String);
  const labels = formData.getAll("additional_link_label").map((value) => String(value).trim());
  const urls = formData.getAll("additional_link_url").map((value) => String(value).trim());
  const links: AdditionalLink[] = [];
  const count = Math.max(sections.length, labels.length, urls.length);

  for (let index = 0; index < count; index += 1) {
    const section = sections[index] as AdditionalLinkSection | undefined;
    const label = labels[index] ?? "";
    const url = urls[index] ?? "";
    if (!section && !label && !url) continue;
    links.push({ section: section ?? "fixture", label, url, position: links.length });
  }

  return validateAdditionalLinks(kind, links);
}
