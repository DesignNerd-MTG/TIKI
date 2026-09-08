import type { Metadata } from "next";
import { ArrowUpRight, LockKeyhole } from "lucide-react";

import { TravelForm } from "@/components/travel-form";
import { PageHeader } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Travel Portal" };

export default async function TravelPage() {
  const { identity } = await requireActiveProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("travel_profiles").select("details,flighty_url,updated_at").eq("user_id", identity.id).maybeSingle();
  const details = typeof data?.details === "string" ? data.details : "";
  const flightyUrl = typeof data?.flighty_url === "string" ? data.flighty_url : "";

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Private operational reference" title="Travel Portal" description="Keep your travel preferences together without mixing sensitive reference details into the knowledge search." />
      <div className="notice notice--neutral"><LockKeyhole size={16} /> These details are visible only to your signed-in account and are never included in global search.</div>
      {flightyUrl && <a className="travel-flighty-link" href={flightyUrl} target="_blank" rel="noreferrer"><span><strong>Open Flighty</strong>Live flight and trip information</span><ArrowUpRight size={18} /></a>}
      <section className="panel editor-panel">
        <div className="panel__heading"><div><p className="eyebrow">Your travel reference</p><h2>Preferences and details</h2></div></div>
        <TravelForm details={details} flightyUrl={flightyUrl} />
      </section>
    </div>
  );
}
