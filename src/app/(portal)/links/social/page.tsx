import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SocialAccountEditor } from "@/components/social-accounts";
import { DatabaseNotice, PageHeader } from "@/components/ui";
import { isSafeExternalUrl } from "@/lib/content-validation";
import { canManageSocial, presentSocialAccount, type SocialAccount } from "@/lib/social-accounts";
import { groupSocialAccounts } from "@/lib/social-directory";
import { DirectoryName } from "@/components/directory-name";
import { allSocialPages } from "@/lib/social-directory-pages";
export const metadata = { title:"Social Directory" };
export default async function SocialDirectory() {
  const { identity,profile } = await requireActiveProfile();
  const client = await createClient();
  const { data, error } = await allSocialPages<SocialAccount>((from,to) => client.rpc("social_directory_index").order("last_name_key").order("display_name_key").order("profile_id").order("id").range(from,to));
  const targets = profile.role === "admin" ? await allSocialPages<{profile_id:string;display_name:string}>((from,to) => client.rpc("social_account_targets").order("profile_id").range(from,to)) : null;
  const rows = (data ?? []) as SocialAccount[];
  const people = groupSocialAccounts(rows, true);
  return <div className="page-stack">
    <PageHeader eyebrow="People & credits" title="Social Directory" description="Find accounts for tagging and credits. Active members manage their own accounts; admins can help any active member." />
    {error || targets?.error ? <DatabaseNotice /> : <>
      {!rows.length && <p>No accounts shared yet. Add your first account below.</p>}
      <DirectoryName name={profile.full_name ?? ""} />
      <section className="social-directory-list" aria-label="Member accounts">{people.map(({id,name,accounts})=><article className="panel social-member" key={id}>
        <h2>{name}</h2>
        <ul className="social-accounts">{accounts.map(row=>{const account=presentSocialAccount(row);return <li className="social-account-row" key={row.id}>
          <div><span>{account.legacy ? "Legacy link" : account.label}</span>{isSafeExternalUrl(row.url) ? <a href={account.legacy ? row.url : account.url} target="_blank" rel="noreferrer">{account.display}</a> : <span>{account.display}</span>}</div>
          {canManageSocial(profile.role,identity.id,row.profile_id) && <SocialAccountEditor item={row} actorId={identity.id} />}
        </li>;})}</ul>
      </article>)}</section>
      <SocialAccountEditor actorId={identity.id} targets={targets ? targets.data ?? [] : undefined} />
    </>}
  </div>;
}
