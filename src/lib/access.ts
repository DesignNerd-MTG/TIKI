import type { AppRole, Profile } from "@/lib/types";

export const roleRank: Record<AppRole, number> = {
  viewer: 0,
  contributor: 1,
  editor: 2,
  admin: 3,
};

export function hasMinimumRole(
  role: AppRole | null | undefined,
  minimumRole: AppRole,
) {
  return role !== null && role !== undefined && roleRank[role] >= roleRank[minimumRole];
}

export function canAccess(
  profile: Pick<Profile, "active" | "role"> | null | undefined,
  minimumRole: AppRole = "viewer",
) {
  return Boolean(profile?.active && hasMinimumRole(profile.role, minimumRole));
}

export function roleLabel(role: AppRole) {
  return role.charAt(0).toUpperCase() + role.slice(1);
}
