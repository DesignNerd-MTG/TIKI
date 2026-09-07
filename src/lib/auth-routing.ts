import type { Profile } from "@/lib/types";

export type PortalEntryRoute = "/login" | "/pending" | "/dashboard";

export function getPortalEntryRoute(
  hasIdentity: boolean,
  profile: Pick<Profile, "active" | "role"> | null | undefined,
): PortalEntryRoute {
  if (!hasIdentity) return "/login";
  if (!profile?.active) return "/pending";
  return "/dashboard";
}
