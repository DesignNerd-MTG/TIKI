"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { contentConfigs } from "@/lib/content";
import { canArchiveContent, canCreateContent, canDeleteContent, canEditContent } from "@/lib/content-rules";
import { isUuid, validateContentInput, type ContentInput } from "@/lib/content-validation";
import { getIdentityAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { EntityKind, ManagedRecord } from "@/lib/types";

export type ContentActionState = {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
};

function isEntityKind(value: string): value is EntityKind {
  return value in contentConfigs;
}

function readInput(formData: FormData, kind: EntityKind): ContentInput {
  const input: ContentInput = {
    status: String(formData.get("status") ?? ""),
    tags: String(formData.get("tags") ?? ""),
    revision_note: String(formData.get("revision_note") ?? ""),
  };
  for (const field of contentConfigs[kind].fields) {
    input[field.name] = field.type === "checkbox" ? formData.get(field.name) === "true" : String(formData.get(field.name) ?? "");
  }
  return input;
}

async function syncTags(supabase: Awaited<ReturnType<typeof createClient>>, kind: EntityKind, entityId: string, names: string[]) {
  const result = await supabase.rpc("set_content_tags", { target_kind: kind, target_id: entityId, tag_names: names });
  return result.error?.message ?? null;
}

export async function saveContentAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const kindValue = String(formData.get("_entity_kind") ?? "");
  if (!isEntityKind(kindValue)) return { ok: false, message: "Unknown content type." };

  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return { ok: false, message: "Your session is no longer active. Sign in again." };

  const kind = kindValue;
  const config = contentConfigs[kind];
  const id = String(formData.get("id") ?? "").trim();
  const supabase = await createClient();
  let existing: ManagedRecord | null = null;

  if (id) {
    const result = await supabase.from(config.table).select("*").eq("id", id).maybeSingle();
    if (result.error || !result.data) return { ok: false, message: "That record could not be loaded. It may have moved or your access changed." };
    existing = result.data as ManagedRecord;
    if (!canEditContent(profile.role, identity.id, kind, existing)) return { ok: false, message: "Your role cannot edit this record." };
  } else if (!canCreateContent(profile.role, kind)) {
    return { ok: false, message: "Your role cannot create this type of content." };
  }

  const input = readInput(formData, kind);
  const validation = validateContentInput(kind, profile.role, input, existing?.status);
  if (!validation.valid) return { ok: false, message: validation.message, fieldErrors: validation.fieldErrors };

  const payload: Record<string, unknown> = { ...validation.payload };
  if (!existing) payload.created_by = identity.id;
  if (kind === "napkin" && profile.role !== "viewer" && profile.role !== "contributor") {
    const convertedKind = String(formData.get("converted_to_kind") ?? "").trim();
    const convertedId = String(formData.get("converted_to_id") ?? "").trim();
    if (convertedKind && (!isEntityKind(convertedKind) || convertedKind === "napkin")) return { ok: false, message: "Check the highlighted fields and try again.", fieldErrors: { converted_to_kind: "Choose a valid destination type." } };
    if (convertedId && !isUuid(convertedId)) return { ok: false, message: "Check the highlighted fields and try again.", fieldErrors: { converted_to_id: "Enter a valid record UUID." } };
    if (String(payload.status) === "converted" && (!convertedKind || !convertedId)) return { ok: false, message: "Filed Napkins must identify their organized record.", fieldErrors: { converted_to_id: "Choose a destination type and enter its record UUID." } };
    payload.converted_to_kind = convertedKind || null;
    payload.converted_to_id = convertedId || null;
  }
  if (["fixture", "show", "link", "document", "location", "drink"].includes(kind) && ["verified", "published"].includes(String(payload.status))) {
    payload.verified_by = identity.id;
    if (kind === "fixture") payload.last_verified_at = new Date().toISOString();
  }

  const result = existing
    ? await supabase.from(config.table).update(payload).eq("id", existing.id).select("id").single()
    : await supabase.from(config.table).insert(payload).select("id").single();
  if (result.error || !result.data) return { ok: false, message: `T.I.K.I. could not save this ${config.singular.toLowerCase()}. ${result.error?.message ?? "Try again."}` };

  const recordId = String(result.data.id);
  const tagError = await syncTags(supabase, kind, recordId, validation.tags);
  let revisionError: string | null = null;
  if (validation.revisionNote) {
    const revision = await supabase.from("revision_notes").insert({
      entity_kind: kind,
      entity_id: recordId,
      summary: validation.revisionNote,
      created_by: identity.id,
    });
    revisionError = revision.error?.message ?? null;
  }

  revalidatePath(config.route);
  if (kind === "napkin") {
    revalidatePath("/napkin/pile");
    revalidatePath("/napkin/queue");
  }
  revalidatePath(`${config.route}/${recordId}`);
  revalidatePath("/dashboard");
  revalidatePath("/search");
  const warnings = [tagError ? `tags: ${tagError}` : null, revisionError ? `revision note: ${revisionError}` : null].filter(Boolean);
  return {
    ok: true,
    message: warnings.length ? `Content saved, but some metadata needs another try (${warnings.join("; ")}).` : `${config.singular} saved.`,
    redirectTo: existing ? undefined : `${config.route}/${recordId}?saved=created`,
  };
}

export async function archiveContentAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const kindValue = String(formData.get("_entity_kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isEntityKind(kindValue) || !id) return { ok: false, message: "The archive request was incomplete." };
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return { ok: false, message: "Your session is no longer active." };
  const config = contentConfigs[kindValue];
  const supabase = await createClient();
  const existingResult = await supabase.from(config.table).select("id,created_by,status").eq("id", id).maybeSingle();
  const existing = existingResult.data as ManagedRecord | null;
  if (!existing || !canArchiveContent(profile.role, identity.id, kindValue, existing)) return { ok: false, message: "Your role cannot archive this record." };
  const result = await supabase.from(config.table).update({ status: "archived" }).eq("id", id);
  if (result.error) return { ok: false, message: `The record could not be archived. ${result.error.message}` };
  await supabase.from("revision_notes").insert({ entity_kind: kindValue, entity_id: id, summary: `Archived from ${existing.status}.`, created_by: identity.id });
  revalidatePath(config.route);
  if (kindValue === "napkin") {
    revalidatePath("/napkin/pile");
    revalidatePath("/napkin/queue");
  }
  revalidatePath(`${config.route}/${id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Record archived. Editors can restore it by selecting another status." };
}

export async function deleteContentAction(_previous: ContentActionState, formData: FormData): Promise<ContentActionState> {
  const kindValue = String(formData.get("_entity_kind") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!isEntityKind(kindValue) || !id) return { ok: false, message: "The delete request was incomplete." };
  const { profile } = await getIdentityAndProfile();
  if (!profile?.active || !canDeleteContent(profile.role)) return { ok: false, message: "Only an active administrator can permanently delete records." };
  const config = contentConfigs[kindValue];
  const supabase = await createClient();
  const existing = await supabase.from(config.table).select("status").eq("id", id).maybeSingle();
  if (existing.data?.status !== "archived") return { ok: false, message: "Archive this record before permanently deleting it." };
  const result = await supabase.from(config.table).delete().eq("id", id);
  if (result.error) return { ok: false, message: `The record could not be deleted. ${result.error.message}` };
  if (!result.error) {
    await supabase.from("content_tags").delete().eq("entity_kind", kindValue).eq("entity_id", id);
    await supabase.from("revision_notes").delete().eq("entity_kind", kindValue).eq("entity_id", id);
    revalidatePath(config.route);
    revalidatePath("/dashboard");
    redirect(kindValue === "napkin" ? "/napkin/pile?deleted=1" : `${config.route}?deleted=1`);
  }
  return { ok: true, message: "Record deleted." };
}
