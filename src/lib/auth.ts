import { redirect } from "next/navigation";

import { canAccess } from "@/lib/access";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { AccessContext, AppRole, Identity, Profile } from "@/lib/types";

export async function getIdentityAndProfile(): Promise<{
  identity: Identity | null;
  profile: Profile | null;
}> {
  if (!isSupabaseConfigured()) {
    return { identity: null, profile: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) {
    return { identity: null, profile: null };
  }

  const email = typeof claims.email === "string" ? claims.email : "";
  const metadata =
    claims.user_metadata && typeof claims.user_metadata === "object"
      ? (claims.user_metadata as Record<string, unknown>)
      : {};
  const fullName =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : null;
  const avatarUrl =
    typeof metadata.avatar_url === "string" ? metadata.avatar_url : null;

  const identity: Identity = {
    id: claims.sub,
    email,
    fullName,
    avatarUrl,
  };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id,email,full_name,avatar_url,role,active,created_at,updated_at")
    .eq("id", identity.id)
    .maybeSingle();

  return { identity, profile: (profile as Profile | null) ?? null };
}

export async function requireActiveProfile(
  minimumRole: AppRole = "viewer",
): Promise<AccessContext> {
  const { identity, profile } = await getIdentityAndProfile();

  if (!identity) redirect("/login");
  if (!profile?.active) redirect("/pending");
  if (!canAccess(profile, minimumRole)) redirect("/dashboard?notice=restricted");

  return { identity, profile };
}
