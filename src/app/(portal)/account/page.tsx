import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/auth";
import { DirectoryName } from "@/components/directory-name";
import { AvatarEditor } from "@/components/avatar-editor";
import { PageHeader } from "@/components/ui";
import { CustomPalettes } from "@/components/custom-palettes";
import { createClient } from "@/lib/supabase/server";
import { validPaletteTokens, type CustomPalette } from "@/lib/theme";

export const metadata: Metadata = { title: "My Account" };

export default async function MyAccountPage() {
  const { identity, profile } = await requireActiveProfile();
  const supabase=await createClient();
  const [{data:rows},{data:appearance}]=await Promise.all([supabase.from("user_custom_palettes").select("slot,name,tokens").eq("profile_id",identity.id).order("slot"),supabase.from("user_appearance").select("active_custom_slot").eq("profile_id",identity.id).maybeSingle()]);
  const palettes=(rows??[]).filter(row=>validPaletteTokens(row.tokens)).map(row=>({slot:row.slot,name:row.name,tokens:row.tokens})) as CustomPalette[];
  return <div className="page-stack profile-editor">
    <PageHeader eyebrow="Your account" title="My Account" description="Manage the display name and avatar shared with active T.I.K.I. members. Private Travel details remain separate." />
    <DirectoryName name={profile.full_name ?? ""} expanded />
    <AvatarEditor id={identity.id} name={profile.full_name || "T.I.K.I. member"} version={profile.updated_at} />
    <CustomPalettes key={JSON.stringify(palettes)} saved={palettes} activeSlot={appearance?.active_custom_slot??null}/>
  </div>;
}
