"use server";
import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
export async function saveDirectoryName(_state: { message: string }, form: FormData) {
  await requireActiveProfile();
  const name = String(form.get("display_name") ?? "").trim();
  if (!name || Array.from(name).length > 100 || !name.isWellFormed() || /[\u0000-\u001f\u007f]/.test(name)) return { message: "Enter a valid name of 1 to 100 characters." };
  const client = await createClient();
  const { error } = await client.rpc("set_directory_display_name", { display_name: name });
  if (error) return { message: "Could not save the name. Please try again or ask an administrator to check database setup." };
  revalidatePath("/", "layout");
  return { message: "Display name saved." };
}
