import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SocialAccountEditor } from "@/components/social-accounts";
import { DatabaseNotice, PageHeader } from "@/components/ui";
import { isSafeExternalUrl } from "@/lib/content-validation";
import { canManageSocial, presentSocialAccount, type SocialAccount } from "@/lib/social-accounts";
import { groupSocialAccounts } from "@/lib/social-directory";
import { DirectoryName } from "@/components/directory-name";
export const metadata = { title:"Social Directory" };
export default async function SocialDirectory() {
  const { identity,profile } = await requireActiveProfile();
  const client = await createClient();
  const { data, error } = await client.rpc("social_directory");
  const targets = profile.role === "admin" ? await client.rpc("social_account_targets") : null;
  const rows = (data ?? []) as SocialAccount[];
  const people = groupSocialAccounts(rows);
  return <div className="page-stack">
    <PageHeader eyebrow="People & credits" title="Social Directory" description="Find accounts for tagging and credits. Active members manage their own accounts; admins can help any active member." />
    {error || targets?.error ? <DatabaseNotice /> : <>
      {!rows.length && <p>No accounts shared yet. Add your first account below.</p>}
      <DirectoryName name={profile.full_name ?? ""} />
      <section className="reference-grid" aria-label="Member accounts">{people.map(({id,name,accounts})=><article className="panel detail-panel" key={id}>
        <h2>{name}</h2>
        <ul className="social-accounts">{accounts.map(row=>{const account=presentSocialAccount(row);return <li key={row.id}>
          <div><span>{account.legacy ? "Legacy link" : account.label}</span>{isSafeExternalUrl(row.url) ? <a href={account.legacy ? row.url : account.url} target="_blank" rel="noreferrer">{account.display}</a> : <span>{account.display}</span>}</div>
          {canManageSocial(profile.role,identity.id,row.profile_id) && <SocialAccountEditor item={row} actorId={identity.id} />}
        </li>;})}</ul>
      </article>)}</section>
      <SocialAccountEditor actorId={identity.id} targets={targets ? targets.data ?? [] : undefined} />
    </>}
  </div>;
}
