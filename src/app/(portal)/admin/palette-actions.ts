"use server";

import { revalidatePath } from "next/cache";

import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validPaletteTokens } from "@/lib/theme";

export type PaletteActionState = { ok: boolean; message: string };

export async function updateSitePaletteAction(_state: PaletteActionState, form: FormData): Promise<PaletteActionState> {
  const { identity } = await requireActiveProfile("admin");
  const client = await createClient();
  const slot = Number(form.get("slot"));
  const command = String(form.get("command") ?? "save");
  if (!Number.isInteger(slot) || slot < 1 || slot > 3) return { ok: false, message: "Choose a valid custom palette slot." };
  if (!["save", "reset", "activate"].includes(command)) return { ok: false, message: "Choose a valid palette action." };

  if (command === "reset") {
    const removed = await client.from("site_custom_palettes").delete().eq("slot", slot);
    if (removed.error) return { ok: false, message: "Palette could not be reset." };
    const appearance = await client.from("site_settings").update({ active_custom_slot: null, updated_by: identity.id }).eq("id", "global").eq("active_custom_slot", slot);
    if (appearance.error) return { ok: false, message: "The palette reset, but the active appearance could not be cleared." };
    revalidatePath("/", "layout");
    return { ok: true, message: `Custom Palette ${slot} reset.` };
  }

  if (command === "activate") {
    const exists = await client.from("site_custom_palettes").select("slot").eq("slot", slot).maybeSingle();
    if (!exists.data) return { ok: false, message: "Save this palette before selecting it." };
    const result = await client.from("site_settings").update({ active_custom_slot: slot, updated_by: identity.id }).eq("id", "global").select("id").maybeSingle();
    if (result.error || !result.data) return { ok: false, message: "Palette could not be selected." };
    revalidatePath("/", "layout");
    return { ok: true, message: `Custom Palette ${slot} is active site-wide.` };
  }

  const name = String(form.get("name") ?? "").trim();
  const tokens = Object.fromEntries(["canvas", "surface", "primary_accent", "secondary_accent", "primary_text", "muted_text"].map((key) => [key, String(form.get(key) ?? "")]));
  if (!name || name.length > 40) return { ok: false, message: "Use a palette name from 1 to 40 characters." };
  if (!validPaletteTokens(tokens)) return { ok: false, message: "Every palette token must be a six-digit hex color." };
  const saved = await client.from("site_custom_palettes").upsert({ slot, name, tokens, updated_by: identity.id }, { onConflict: "slot" });
  if (saved.error) return { ok: false, message: "Palette could not be saved." };
  revalidatePath("/", "layout");
  return { ok: true, message: `${name} saved.` };
}
