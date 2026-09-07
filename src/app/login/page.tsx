import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole, ScanSearch } from "lucide-react";

import { Brand } from "@/components/brand";
import { EmailAuthForm } from "@/components/email-auth-form";
import { getIdentityAndProfile } from "@/lib/auth";
import { getSupabaseConfigStatus } from "@/lib/supabase/config";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; setup?: string }>;
}) {
  const configStatus = getSupabaseConfigStatus();
  const configured = configStatus.configured;
  const { identity, profile } = configured
    ? await getIdentityAndProfile()
    : { identity: null, profile: null };
  const params = await searchParams;

  if (identity && profile?.active) {
    // A normal link avoids a redirect exception being swallowed by auth setup errors.
    return (
      <main className="centered-message">
        <Brand />
        <h1>You’re already signed in.</h1>
        <Link className="primary-button" href="/dashboard">Open dashboard <ArrowRight size={17} /></Link>
      </main>
    );
  }

  if (identity) {
    return (
      <main className="centered-message">
        <Brand />
        <p className="eyebrow">Signed in as {identity.email}</p>
        <h1>Your access is pending.</h1>
        <p>An administrator still needs to activate your T.I.K.I. profile.</p>
        <div className="button-row">
          <Link className="primary-button" href="/pending">Check access <ArrowRight size={17} /></Link>
          <form action="/auth/signout" method="post"><button className="secondary-button" type="submit">Sign out</button></form>
        </div>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div className="login-story__top"><Brand inverse /></div>
        <div className="login-story__content">
          <p className="eyebrow eyebrow--light">LDG Entertainment Division</p>
          <h1>The answer should be easier to find.</h1>
          <p className="login-story__lead">
            One private front door for fixture data, show references, trusted links,
            documents, and the knowledge that usually lives in someone’s head.
          </p>
          <div className="login-proof">
            <div><ScanSearch size={20} /><span><strong>Search first</strong>Find the useful answer, not the folder maze.</span></div>
            <div><CheckCircle2 size={20} /><span><strong>Trust the source</strong>See what is verified, when, and by whom.</span></div>
            <div><LockKeyhole size={20} /><span><strong>Keep it private</strong>Identity and department access stay separate.</span></div>
          </div>
        </div>
        <p className="login-story__footer">Be the map, not the territory.</p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <p className="eyebrow">Private production portal</p>
          <h2>Welcome to T.I.K.I.</h2>
          <p>Sign in with your email and password. New accounts wait for an administrator before any department content is visible.</p>

          {params.error && (
            <div className="notice notice--error" role="alert">
              That email link could not be completed. It may have expired; please try again.
            </div>
          )}
          {!configStatus.configured && (
            <div className="setup-card">
              <strong>Setup mode</strong>
              <span>{configStatus.message}</span>
            </div>
          )}

          <EmailAuthForm configured={configured} />

          {!configStatus.configured && (
            <Link className="preview-link" href="/preview">
              Preview the portal first <ArrowRight size={16} />
            </Link>
          )}

          <p className="security-note"><LockKeyhole size={14} /> Supabase verifies identity. T.I.K.I. decides access.</p>
        </div>
      </section>
    </main>
  );
}
