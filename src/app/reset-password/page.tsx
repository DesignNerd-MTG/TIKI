import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";

import { Brand } from "@/components/brand";
import { UpdatePasswordForm } from "@/components/update-password-form";
import { getIdentityAndProfile } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Set a new password" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const configured = isSupabaseConfigured();
  const { identity } = configured
    ? await getIdentityAndProfile()
    : { identity: null };

  return (
    <main className="pending-page">
      <Brand />
      <section className="pending-card password-card">
        <span className="pending-card__icon"><KeyRound size={28} /></span>
        <p className="eyebrow">Account security</p>
        <h1>Choose a new password.</h1>
        {!identity ? (
          <>
            <p>This password-reset link is missing, expired, or has already been used.</p>
            <Link className="primary-button" href="/login">Request another link</Link>
          </>
        ) : (
          <UpdatePasswordForm />
        )}
      </section>
    </main>
  );
}
