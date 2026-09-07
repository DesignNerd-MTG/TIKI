import { getIdentityAndProfile } from "@/lib/auth";
import { redirectToPath } from "@/lib/http";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return redirectToPath("/login");
  if (!profile?.active) return redirectToPath("/pending");

  const form = await request.formData();
  const body = String(form.get("body") ?? "").trim();
  const sourceUrl = String(form.get("source_url") ?? "").trim();
  const urgent = form.get("urgent") === "true";

  if (!body || body.length > 4000) {
    return redirectToPath("/napkin?error=validation");
  }

  const supabase = await createClient();
  const { error } = await supabase.from("napkin_notes").insert({
    body,
    source_url: sourceUrl || null,
    urgent,
    created_by: identity.id,
  });

  const destination = error ? "/napkin?error=save" : "/napkin?saved=1";
  return redirectToPath(destination);
}
