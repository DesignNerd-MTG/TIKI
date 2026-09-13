"use server";

import { revalidatePath } from "next/cache";
import { getIdentityAndProfile } from "@/lib/auth";
import { isSafeExternalUrl, isUuid } from "@/lib/content-validation";
import { createClient } from "@/lib/supabase/server";
import { checkReference } from "@/lib/reference-fetch";
import { prepareNotionImport } from "@/lib/notion-import";
import { recheckReference } from "@/lib/reference-recheck";
import type { ContentActionState } from "@/app/(portal)/content-actions";

export async function recheckReferenceAction(_state: ContentActionState, form: FormData): Promise<ContentActionState> {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return { ok: false, message: "Sign in with an active account to recheck." };
  const id = String(form.get("id") ?? "");
  if (!isUuid(id)) return { ok: false, message: "Choose an existing reference." };
  const client = await createClient();
  const { data: record, error } = await client.from("link_items").select("id,url,status,created_by,updated_at").eq("id",id).maybeSingle();
  if (error || !record) return { ok: false, message: "This reference could not be loaded." };
  const state = await recheckReference(profile.role,identity.id,record,{
    check: checkReference,
    save: async (result, updatedAt) => {
      const saved = await client.from("link_items").update(result).eq("id",id).eq("updated_at",updatedAt).select("id").maybeSingle();
      return !saved.error && Boolean(saved.data);
    },
    note: async (summary) => {
      const revision = await client.from("revision_notes").insert({ entity_kind: "link", entity_id: id, created_by: identity.id, summary });
      return !revision.error;
    },
  });
  if (state.ok) {
    revalidatePath("/links");
    revalidatePath("/links/" + id);
    revalidatePath("/search");
  }
  return state;
}

export async function importNotionAction(_state: ContentActionState, form: FormData): Promise<ContentActionState> {
  const { profile } = await getIdentityAndProfile();
  if (!profile?.active || profile.role !== "admin") return { ok: false, message: "Administrator access required." };
  const raw = String(form.get("manifest") ?? "");
  if (raw.length > 250000) return { ok: false, message: "Manifest exceeds 250 KB." };
  try {
    const report = prepareNotionImport(JSON.parse(raw));
    const summary = report.issues.map((item) => item.label + ": " + item.reason).join("\n");
    if (form.get("mode") !== "import") return { ok: true, message: report.records.length + " ready; " + report.ignored + " blank rows ignored.\n" + summary };
    if (!report.records.length) return { ok: false, message: "No complete references to import.\n" + summary };
    const client = await createClient();
    const existing = await client.from("link_items").select("import_source").in("import_source", report.records.map((row) => row.import_source));
    if (existing.error) return { ok: false, message: "Could not check previous imports. Apply the Reference Hub migration first." };
    const seen = new Set((existing.data ?? []).map((row) => row.import_source));
    const remaining = report.records.filter((row) => !seen.has(row.import_source));
    // Ten records per click, five checks at a time: at most two bounded fetch windows.
    // A rerun skips imported sources before fetching; SQL also guards concurrent imports.
    const batch = remaining.slice(0,10);
    const checked = [];
    for (let index = 0; index < batch.length; index += 5) {
      checked.push(...await Promise.all(batch.slice(index,index + 5).map(async (row) => ({ ...row, ...await checkReference(row.url) }))));
    }
    const result = await client.rpc("import_notion_references", { records: checked });
    if (result.error) return { ok: false, message: "Import did not complete. Check that the Reference Hub migration is applied. No partial batch is committed." };
    revalidatePath("/links");
    revalidatePath("/dashboard");
    revalidatePath("/search");
    const imported = (result.data ?? []).filter((row: { outcome: string }) => row.outcome === "imported").length;
    return { ok: true, message: imported + " imported as drafts; " + (seen.size + batch.length - imported) + " already imported. " + report.ignored + " blank rows ignored. " + (remaining.length - batch.length) + " complete rows remain; submit again to continue. Failed link checks do not prevent import.\n" + summary };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Invalid manifest." };
  }
}

export async function saveSocialLinkAction(_state: ContentActionState, form: FormData): Promise<ContentActionState> {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return { ok: false, message: "Active account required." };
  const id = String(form.get("id") ?? "");
  const label = String(form.get("label") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  if (id && !isUuid(id)) return { ok: false, message: "Invalid link." };
  const client = await createClient();
  if (form.get("remove") === "true" && id) {
    const result = await client.from("profile_social_links").delete().eq("id",id).eq("profile_id",identity.id).select("id").maybeSingle();
    if (result.error || !result.data) return { ok: false, message: "Could not remove your link." };
  } else {
    if (!label || label.length > 80 || !url || url.length > 2048 || !isSafeExternalUrl(url)) return { ok: false, message: "Enter a label (up to 80 characters) and a complete HTTP(S) URL." };
    const payload = { profile_id: identity.id, label, url };
    const result = id
      ? await client.from("profile_social_links").update(payload).eq("id",id).eq("profile_id",identity.id).select("id").maybeSingle()
      : await client.from("profile_social_links").insert(payload).select("id").single();
    if (result.error || !result.data) return { ok: false, message: "Could not save your public link." };
  }
  revalidatePath("/links/social");
  return { ok: true, message: "Your public links were updated." };
}
