import type { Metadata } from "next";
import { ArrowUpRight, LockKeyhole } from "lucide-react";

import { TravelForm } from "@/components/travel-form";
import { SharedTravelLookup } from "@/components/shared-travel-lookup";
import { PageHeader } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Travel Prefs" };

export default async function TravelPage() {
  const { identity } = await requireActiveProfile();
  const supabase = await createClient();
  const [{ data }, flightyResult, bookingResult] = await Promise.all([
    supabase.from("travel_profiles").select("name,details,flighty_url,share_flighty,share_booking,updated_at").eq("user_id", identity.id).maybeSingle(),
    supabase.rpc("shared_flighty_profiles"),
    supabase.rpc("shared_booking_profiles"),
  ]);
  const name = typeof data?.name === "string" ? data.name : "";
  const details = typeof data?.details === "string" ? data.details : "";
  const flightyUrl = typeof data?.flighty_url === "string" ? data.flighty_url : "";

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Private operational reference" title="Travel Prefs" description="Keep your travel preferences together without mixing sensitive reference details into the knowledge search." />
      <div className="notice notice--neutral"><LockKeyhole size={16} /> Your unshared details are visible only to your signed-in account and never included in global search. Only items you explicitly share appear in the scoped team lookup.</div>
      {flightyUrl && <a className="travel-flighty-link" href={flightyUrl} target="_blank" rel="noreferrer"><span><strong>Open Flighty</strong>Live flight and trip information</span><ArrowUpRight size={18} /></a>}
      <section className="panel editor-panel">
        <div className="panel__heading"><div><p className="eyebrow">Your travel reference</p><h2>Preferences and details</h2></div></div>
        <TravelForm name={name} details={details} flightyUrl={flightyUrl} shareFlighty={Boolean(data?.share_flighty)} shareBooking={Boolean(data?.share_booking)} />
      </section>
      <SharedTravelLookup flighty={flightyResult.data ?? []} booking={bookingResult.data ?? []} />
    </div>
  );
}
