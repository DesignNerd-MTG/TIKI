import { presentSocialAccount, socialPlatforms, type SocialAccount } from "./social-accounts.ts";
export const directoryName = (name: string | null | undefined) => name?.trim() || "T.I.K.I. member";
const compare = (a: string, b: string) => a.toLowerCase().localeCompare(b.toLowerCase(), "en");
export function groupSocialAccounts(rows: SocialAccount[]) {
  const groups = new Map<string, SocialAccount[]>();
  for (const row of rows) groups.set(row.profile_id, [...(groups.get(row.profile_id) ?? []), row]);
  return Array.from(groups, ([id, accounts]) => ({
    id, name: directoryName(accounts[0].display_name),
    accounts: accounts.sort((a, b) => {
      const left = presentSocialAccount(a), right = presentSocialAccount(b);
      return socialPlatforms.indexOf(left.platform) - socialPlatforms.indexOf(right.platform)
        || compare(left.display, right.display) || a.id.localeCompare(b.id, "en");
    }),
  })).sort((a, b) => compare(a.name, b.name) || a.id.localeCompare(b.id, "en"));
}
