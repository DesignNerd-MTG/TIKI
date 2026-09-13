"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isThemePreset } from "@/lib/theme";

export type AppearanceActionState = { ok: boolean; message: string };

export async function updateAppearanceAction(
  _previousState: AppearanceActionState,
  formData: FormData,
): Promise<AppearanceActionState> {
  const { identity } = await requireActiveProfile("admin");
  const appearance = String(formData.get("appearance") ?? "");
  const customMatch = /^custom-([1-3])$/.exec(appearance);
  const theme = customMatch ? formData.get("base_theme") : appearance;

  if (!isThemePreset(theme)) {
    return { ok: false, message: "Choose one of the available T.I.K.I. themes." };
  }

  const supabase = await createClient();
  const activeCustomSlot = customMatch ? Number(customMatch[1]) : null;
  if (activeCustomSlot) {
    const palette = await supabase.from("site_custom_palettes").select("slot").eq("slot", activeCustomSlot).maybeSingle();
    if (!palette.data) return { ok: false, message: "Save that custom palette before selecting it." };
  }
  const { data, error } = await supabase
    .from("site_settings")
    .update({ theme, active_custom_slot: activeCustomSlot, updated_by: identity.id })
    .eq("id", "global")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { ok: false, message: "T.I.K.I. could not save the appearance setting. Please try again." };
  }

  revalidatePath("/", "layout");
  return { ok: true, message: "Appearance updated for everyone in T.I.K.I." };
}
