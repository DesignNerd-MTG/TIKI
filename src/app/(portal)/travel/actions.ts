"use server";

import { revalidatePath } from "next/cache";

import { getIdentityAndProfile } from "@/lib/auth";
import { isSafeExternalUrl, normalizeExternalUrl } from "@/lib/content-validation";
import { createClient } from "@/lib/supabase/server";

export type TravelActionState = { ok: boolean; message: string; fieldErrors?: Record<string, string> };

export async function saveTravelAction(_previous: TravelActionState, formData: FormData): Promise<TravelActionState> {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return { ok: false, message: "Your session is no longer active. Sign in again." };

  const name = String(formData.get("name") ?? "").trim();
  const details = String(formData.get("details") ?? "").trim();
  const flightyUrl = normalizeExternalUrl(String(formData.get("flighty_url") ?? ""));
  const shareFlighty = formData.get("share_flighty") === "true";
  const shareBooking = formData.get("share_booking") === "true";
  const fieldErrors: Record<string, string> = {};
  if (name.length > 160) fieldErrors.name = "Keep the name to 160 characters or fewer.";
  if (details.length > 12000) fieldErrors.details = "Keep travel details to 12,000 characters or fewer.";
  if (flightyUrl.length > 2048 || (flightyUrl && !isSafeExternalUrl(flightyUrl))) fieldErrors.flighty_url = "Use a valid web address or http:// or https:// URL.";
  if (Object.keys(fieldErrors).length) return { ok: false, message: "Check the highlighted fields and try again.", fieldErrors };

  const supabase = await createClient();
  const result = await supabase.from("travel_profiles").upsert({
    user_id: identity.id,
    name: name || null,
    details: details || null,
    flighty_url: flightyUrl || null,
    share_flighty: shareFlighty,
    share_booking: shareBooking,
  }, { onConflict: "user_id" });
  if (result.error) return { ok: false, message: `T.I.K.I. could not save your travel details. ${result.error.message}` };

  revalidatePath("/travel");
  return { ok: true, message: "Travel details saved." };
}
