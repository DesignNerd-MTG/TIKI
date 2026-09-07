import { contentConfigs } from "./content.ts";
import { canSetStatus } from "./content-rules.ts";
import type { AppRole, EntityKind } from "@/lib/types";

export type ContentInput = Record<string, string | boolean>;
export type ValidationResult =
  | { valid: true; payload: Record<string, string | number | boolean | null>; tags: string[]; revisionNote: string }
  | { valid: false; fieldErrors: Record<string, string>; message: string };

export function normalizeTags(value: string) {
  const seen = new Set<string>();
  return value.split(",").map((tag) => tag.trim().replace(/\s+/g, " ")).filter((tag) => {
    const slug = tag.toLowerCase();
    if (!tag || tag.length > 40 || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  }).slice(0, 12);
}

export function slugifyTag(value: string) {
  return value.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

export function isSafeExternalUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateContentInput(kind: EntityKind, role: AppRole, input: ContentInput, previousStatus?: string): ValidationResult {
  const config = contentConfigs[kind];
  const errors: Record<string, string> = {};
  const payload: Record<string, string | number | boolean | null> = {};

  for (const field of config.fields) {
    if (field.type === "checkbox") {
      payload[field.name] = input[field.name] === true || input[field.name] === "true";
      continue;
    }
    const value = String(input[field.name] ?? "").trim();
    if (field.required && !value) errors[field.name] = `${field.label} is required.`;
    if (field.maxLength && value.length > field.maxLength) errors[field.name] = `${field.label} is too long.`;
    if (field.type === "url" && value.length > 2048) errors[field.name] = "URL must be 2,048 characters or fewer.";
    if (field.type === "url" && value && !isSafeExternalUrl(value)) errors[field.name] = "Use a complete http:// or https:// URL.";
    if (field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.name] = "Use a valid date.";
    if (field.type === "number") {
      if (!value) payload[field.name] = null;
      else {
        const number = Number(value);
        if (!Number.isInteger(number) || number < 1 || number > 32768) errors[field.name] = "Enter a positive whole number.";
        else payload[field.name] = number;
      }
    } else {
      payload[field.name] = value || null;
    }
  }

  const status = String(input.status ?? (kind === "napkin" ? "raw" : "draft"));
  if (!canSetStatus(role, kind, status)) errors.status = "Your role cannot set that status.";
  if (!previousStatus && status === "archived") errors.status = "Create the record before archiving it.";
  payload.status = status;

  if (kind === "show") {
    const start = String(input.start_date ?? "");
    const end = String(input.end_date ?? "");
    if (start && end && end < start) errors.end_date = "End date must be on or after the start date.";
  }

  const tagsRaw = String(input.tags ?? "");
  const tags = normalizeTags(tagsRaw);
  if (tagsRaw.split(",").filter((tag) => tag.trim()).length > 12) errors.tags = "Use no more than 12 tags.";
  if (tagsRaw.split(",").some((tag) => tag.trim().length > 40)) errors.tags = "Each tag must be 40 characters or fewer.";
  const revisionNote = String(input.revision_note ?? "").trim();
  if (revisionNote.length > 500) errors.revision_note = "Revision note must be 500 characters or fewer.";
  const adminPublishing = role === "admin" && status === "published";
  if (previousStatus && previousStatus !== status && !revisionNote && !adminPublishing) errors.revision_note = "Explain this status change for the revision history.";

  if (Object.keys(errors).length) return { valid: false, fieldErrors: errors, message: "Check the highlighted fields and try again." };
  return { valid: true, payload, tags, revisionNote };
}

export function buildSearchPattern(query: string) {
  const cleaned = query.trim().replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim().slice(0, 100);
  return cleaned ? `%${cleaned}%` : "";
}
