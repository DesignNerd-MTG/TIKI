import { getIdentityAndProfile } from "@/lib/auth";
import { redirectToPath } from "@/lib/http";
import { isUuid } from "@/lib/content-validation";
import { createClient } from "@/lib/supabase/server";
import { roles, type AppRole } from "@/lib/types";

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return redirectToPath("/login");
  if (!profile?.active || profile.role !== "admin") {
    return redirectToPath("/dashboard?notice=restricted");
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "") as AppRole;
  const active = form.get("active") === "true";

  if (!isUuid(id) || !roles.includes(role)) {
    return redirectToPath("/admin?error=validation");
  }

  // Prevent an administrator from accidentally locking out their own active session.
  if (id === identity.id && (!active || role !== "admin")) {
    return redirectToPath("/admin?error=self-lockout");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, active }).eq("id", id);
  const destination = error ? "/admin?error=save" : "/admin?saved=1";
  return redirectToPath(destination);
}
