import { NextResponse } from "next/server";

import { getIdentityAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  if (!profile?.active) return NextResponse.redirect(new URL("/pending", request.url), { status: 303 });

  const form = await request.formData();
  const body = String(form.get("body") ?? "").trim();
  const sourceUrl = String(form.get("source_url") ?? "").trim();
  const urgent = form.get("urgent") === "true";

  if (!body || body.length > 4000) {
    return NextResponse.redirect(new URL("/napkin?error=validation", request.url), { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("napkin_notes").insert({
    body,
    source_url: sourceUrl || null,
    urgent,
    created_by: identity.id,
  });

  const destination = error ? "/napkin?error=save" : "/napkin?saved=1";
  return NextResponse.redirect(new URL(destination, request.url), { status: 303 });
}
