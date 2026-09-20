import { isGooglePhotosUrl } from "./show-production.ts";
import { contentConfigs } from "./content.ts";
import { validFixtureWattage, validFixtureWeight } from "./fixture-physical.ts";
import { canSetStatus } from "./content-rules.ts";
import { referenceDefaults, validCollectionPair, isReferenceTimestamp } from "./references.ts";
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

export function normalizeExternalUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return trimmed;
  const domain = /^(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}(?::\d{1,5})?(?:[/?#].*)?$/i;
  return domain.test(trimmed) ? `https://${trimmed}` : trimmed;
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

export function validateContentInput(kind: EntityKind, role: AppRole, input: ContentInput, previousStatus?: string, previousRecord?: Record<string, unknown>): ValidationResult {
  if (kind === "link") {
    input = { ...input, url: normalizeExternalUrl(String(input.url ?? "")) };
    input = referenceDefaults(input);
  }
  const config = contentConfigs[kind];
  const errors: Record<string, string> = {};
  const payload: Record<string, string | number | boolean | null> = {};

  for (const field of config.fields) {
    if (field.type === "checkbox") {
      payload[field.name] = input[field.name] === true || input[field.name] === "true";
      continue;
    }
    if (field.type === "boolean-select") {
      const value = String(input[field.name] ?? "").trim();
      if (field.required && !value) errors[field.name] = `${field.label} is required.`;
      if (value && value !== "true" && value !== "false") errors[field.name] = `Choose Yes or No for ${field.label.toLowerCase()}.`;
      payload[field.name] = value ? value === "true" : null;
      continue;
    }
    const rawValue = String(input[field.name] ?? "").trim();
    const value = field.type === "url" ? normalizeExternalUrl(rawValue) : rawValue;
    if (field.required && !value) errors[field.name] = `${field.label} is required.`;
    const unchangedLegacyShowLocation = kind === "show" && field.name === "location" && !previousRecord?.location_data && String(previousRecord?.location ?? "") === String(input.location ?? "");
    if (field.maxLength && value.length > field.maxLength && !unchangedLegacyShowLocation) errors[field.name] = `${field.label} is too long.`;
    if (field.type === "url" && value.length > 2048) errors[field.name] = "URL must be 2,048 characters or fewer.";
    if (field.type === "url" && value && !isSafeExternalUrl(value)) errors[field.name] = "Use a valid web address or http:// or https:// URL.";
    if (field.type === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) errors[field.name] = "Use a valid date.";
    if (field.type === "select" && value && field.options && !field.options.some((option) => option.value === value)) {
      const unchangedLegacyValue = field.name !== "ip_rating" && previousRecord && String(previousRecord[field.name] ?? "") === value;
      if (!unchangedLegacyValue) errors[field.name] = `Choose a listed ${field.label.toLowerCase()}.`;
    }
    if (field.type === "number") {
      if (!value) payload[field.name] = null;
      else {
        const number = Number(value);
        if (kind === "fixture" && field.name === "weight_lb") {
          if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !validFixtureWeight(number)) errors[field.name] = "Enter a weight greater than 0 and at most 10,000 lb.";
          else payload[field.name] = number;
        } else if (kind === "fixture" && field.name === "wattage") {
          if (!/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value) || !validFixtureWattage(number)) errors[field.name] = "Enter wattage greater than 0.";
          else payload[field.name] = number;
        } else if (!Number.isInteger(number) || number < 1 || number > 32768) errors[field.name] = "Enter a positive whole number.";
        else payload[field.name] = number;
      }
    } else {
      payload[field.name] = kind === "napkin" && field.name === "body" ? value : value || null;
    }
  }

  if (kind === "napkin" && !String(payload.body ?? "").trim() && input._has_sketch !== "true" && !previousRecord?.sketch_path) {
    errors.body = "Add text or draw a sketch before storing this Napkin.";
  }

  const status = String(input.status ?? (kind === "napkin" ? "raw" : "draft"));
  if (!canSetStatus(role, kind, status)) errors.status = "Your role cannot set that status.";
  if (!previousStatus && status === "archived") errors.status = "Create the record before archiving it.";
  payload.status = status;

  if (kind === "link") {
    if (!String(payload.label ?? "").trim()) errors.label = "Add a title when this reference has no URL.";
    if (!validCollectionPair(String(input.collection_id), String(input.subcollection_id))) {
      errors.subcollection_id = "Choose a subcollection within the selected collection.";
    }
    const date = String(input.date_added);
    if (!isReferenceTimestamp(date)) {
      errors.date_added = "Use a valid ISO date and time with a timezone.";
    }
    payload.category = String(input.category);
  }

  if (kind === "show") {
    if (!isGooglePhotosUrl(String(payload.google_photos_url ?? ""))) errors.google_photos_url = "Use a Google Photos album link (photos.google.com or photos.app.goo.gl).";
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
