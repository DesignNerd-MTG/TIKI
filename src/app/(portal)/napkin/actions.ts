"use server";

import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { canEditContent } from "@/lib/content-rules";
import { isUuid } from "@/lib/content-validation";
import { createClient } from "@/lib/supabase/server";

export async function setNapkinPinnedAction(_state: { message: string }, formData: FormData) {
  const { identity, profile } = await requireActiveProfile();
  const id = String(formData.get("id") ?? "");
  const pinned = formData.get("intent") === "pin";
  if (!isUuid(id)) return { message: "That Napkin could not be found." };
  const client = await createClient();
  const current = await client.from("napkin_notes").select("id,created_by,status,pinned").eq("id", id).maybeSingle();
  if (!current.data || !canEditContent(profile.role, identity.id, "napkin", current.data)) {
    return { message: "Your role cannot change this Napkin." };
  }
  const result = await client.from("napkin_notes").update({ pinned }).eq("id", id).select("id").single();
  if (result.error) return { message: "The pin could not be updated. Please try again." };
  revalidatePath(`/napkin/${id}`);
  revalidatePath("/napkin/pinned");
  return { message: pinned ? "Napkin pinned." : "Napkin unpinned." };
}
