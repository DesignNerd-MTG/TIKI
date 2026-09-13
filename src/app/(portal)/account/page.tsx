import type { Metadata } from "next";
import { requireActiveProfile } from "@/lib/auth";
import { DirectoryName } from "@/components/directory-name";
import { AvatarEditor } from "@/components/avatar-editor";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "My Account" };

export default async function MyAccountPage() {
  const { identity, profile } = await requireActiveProfile();
  return <div className="page-stack profile-editor">
    <PageHeader eyebrow="Your account" title="My Account" description="Manage the display name and avatar shared with active T.I.K.I. members. Private Travel details remain separate." />
    <DirectoryName name={profile.full_name ?? ""} expanded />
    <AvatarEditor id={identity.id} name={profile.full_name || "T.I.K.I. member"} version={profile.updated_at} />
  </div>;
}
