import { presentSocialAccount, socialPlatforms, type SocialAccount } from "./social-accounts.ts";
export const directoryName = (name: string | null | undefined) => name?.trim() || "T.I.K.I. member";
export const directoryLastName = (name: string | null | undefined) => directoryName(name).split(/\s+/).at(-1)!;
const compare = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase(), "en");
export function groupSocialAccounts(rows: SocialAccount[], preserveMemberOrder = false) {
  const groups = new Map<string, SocialAccount[]>();
  for (const row of rows) groups.set(row.profile_id, [...(groups.get(row.profile_id) ?? []), row]);
  const people = Array.from(groups, ([id, accounts]) => ({
    id, name: directoryName(accounts[0].display_name),
    accounts: accounts.sort((a, b) => {
      const left = presentSocialAccount(a), right = presentSocialAccount(b);
      return socialPlatforms.indexOf(left.platform) - socialPlatforms.indexOf(right.platform)
        || compare(left.display, right.display) || a.id.localeCompare(b.id, "en");
    }),
  }));
  // Production pages are already ordered by database-derived keys before paging.
  return preserveMemberOrder ? people : people.sort((a, b) => compare(directoryLastName(a.name), directoryLastName(b.name)) || compare(a.name, b.name) || a.id.localeCompare(b.id, "en"));
}
