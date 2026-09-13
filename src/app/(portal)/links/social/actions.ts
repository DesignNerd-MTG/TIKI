"use server";
import { revalidatePath } from "next/cache";
import { getIdentityAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/content-validation";
import { canManageSocial, normalizeSocialAccount } from "@/lib/social-accounts";
import type { ContentActionState } from "@/app/(portal)/content-actions";

export async function saveSocialAccountAction(_state: ContentActionState, form: FormData): Promise<ContentActionState> {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return { ok:false,message:"Active account required." };
  const id = String(form.get("id") ?? "");
  if (id && !isUuid(id)) return { ok:false,message:"Choose an existing account." };
  const client = await createClient();
  let target = String(form.get("profile_id") || identity.id);
  if (id) {
    const existing = await client.from("profile_social_links").select("profile_id").eq("id",id).maybeSingle();
    if (existing.error || !existing.data) return { ok:false,message:"Account could not be loaded." };
    target = existing.data.profile_id; // Editing never transfers ownership.
  }
  if (!isUuid(target) || !canManageSocial(profile.role,identity.id,target)) return { ok:false,message:"You may only manage your own accounts." };
  const active = await client.rpc("social_account_target_active",{target_id:target});
  if (active.error || active.data !== true) return { ok:false,message:"Choose an active member. Social account permissions must be configured." };
  if (form.get("remove") === "true") {
    if (!id) return { ok:false,message:"Choose an existing account." };
    const result = await client.from("profile_social_links").delete().eq("id",id).eq("profile_id",target).select("id").maybeSingle();
    if (result.error || !result.data) return { ok:false,message:"Could not remove this account." };
  } else {
    let account;
    try { account = normalizeSocialAccount(String(form.get("platform") ?? ""),String(form.get("account") ?? "")); }
    catch (error) { const message = error instanceof Error ? error.message : "Check the account."; return { ok:false,message,fieldErrors:{account:message} }; }
    const payload = { profile_id:target,label:account.label,url:account.url };
    const result = id
      ? await client.from("profile_social_links").update(payload).eq("id",id).eq("profile_id",target).select("id").maybeSingle()
      : await client.from("profile_social_links").insert(payload).select("id").single();
    if (result.error || !result.data) return { ok:false,message:"Could not save this account. Please try again." };
  }
  revalidatePath("/links/social");
  return { ok:true,message:form.get("remove") === "true" ? "Account removed." : "Account saved. You can add another account." };
}
