import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SocialLinkForm } from "@/components/reference-controls";
import { DatabaseNotice, PageHeader } from "@/components/ui";
import { isSafeExternalUrl } from "@/lib/content-validation";
export default async function SocialDirectory() {
  const { identity } = await requireActiveProfile();
  const client = await createClient();
  const { data, error } = await client.rpc("social_directory");
  const rows = (data ?? []) as Array<{ id: string; profile_id: string; display_name: string; label: string; url: string }>;
  return <div className="page-stack"><PageHeader eyebrow="People & credits" title="Social Directory" description="Public links shared by active T.I.K.I. members for tagging and credits. Each person manages their own links." />
    {error ? <DatabaseNotice /> : rows.length ? <section className="reference-grid">{rows.map((row) => <article className="panel detail-panel" key={row.id}><h2>{row.display_name}</h2>{isSafeExternalUrl(row.url) && <a href={row.url} target="_blank" rel="noreferrer">{row.label}</a>}</article>)}</section> : <p>No public links shared yet. Add yours below.</p>}
    <section className="panel editor-panel"><h2>Your public links</h2>{rows.filter((row) => row.profile_id === identity.id).map((item) => <SocialLinkForm key={item.id} item={item} />)}<h3>Add a link</h3><SocialLinkForm /></section></div>;
}
