import { NextResponse } from "next/server";

import { getIdentityAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { roles, type AppRole } from "@/lib/types";

export async function POST(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) return NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  if (!profile?.active || profile.role !== "admin") {
    return NextResponse.redirect(new URL("/dashboard?notice=restricted", request.url), { status: 303 });
  }

  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  const role = String(form.get("role") ?? "") as AppRole;
  const active = form.get("active") === "true";

  if (!id || !roles.includes(role)) {
    return NextResponse.redirect(new URL("/admin?error=validation", request.url), { status: 303 });
  }

  // Prevent an administrator from accidentally locking out their own active session.
  if (id === identity.id && (!active || role !== "admin")) {
    return NextResponse.redirect(new URL("/admin?error=self-lockout", request.url), { status: 303 });
  }

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role, active }).eq("id", id);
  const destination = error ? "/admin?error=save" : "/admin?saved=1";
  return NextResponse.redirect(new URL(destination, request.url), { status: 303 });
}
