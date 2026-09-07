import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock3, LogOut, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

import { Brand } from "@/components/brand";
import { getIdentityAndProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Access pending" };
export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity) redirect("/login");
  if (profile?.active) redirect("/dashboard");

  return (
    <main className="pending-page">
      <Brand />
      <section className="pending-card">
        <span className="pending-card__icon"><Clock3 size={28} /></span>
        <p className="eyebrow">Signed in</p>
        <h1>Access is pending.</h1>
        <p>
          Supabase confirmed <strong>{identity.email}</strong>. An administrator still needs
          to activate your T.I.K.I. profile and assign a role.
        </p>
        <div className="pending-steps">
          <div className="pending-step pending-step--done"><ShieldCheck size={19} /><span><strong>Email sign-in</strong>Complete</span></div>
          <div className="pending-step"><Clock3 size={19} /><span><strong>Department approval</strong>Waiting for an admin</span></div>
        </div>
        <p className="pending-help">Ask a T.I.K.I. administrator to activate this email, then refresh the page.</p>
        <div className="button-row">
          <Link className="primary-button" href="/pending">Check again <ArrowRight size={17} /></Link>
          <form action="/auth/signout" method="post"><button className="secondary-button" type="submit"><LogOut size={16} /> Sign out</button></form>
        </div>
      </section>
    </main>
  );
}
