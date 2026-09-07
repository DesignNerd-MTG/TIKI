import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, Cable, CheckCircle2, FileText, Lightbulb, Zap } from "lucide-react";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fixture detail" };

export default async function FixtureDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: fixture } = await supabase
    .from("fixtures")
    .select("id,name,manufacturer,fixture_type,preferred_mode,dmx_footprint,typical_use,power_note,control_note,field_notes,dmx_chart_url,manual_url,status,last_verified_at,updated_at")
    .eq("id", id)
    .maybeSingle();

  if (!fixture) notFound();

  return (
    <div className="page-stack">
      <Link className="back-link" href="/fixtures"><ArrowLeft size={16} /> Back to fixtures</Link>
      <section className="detail-hero">
        <div>
          <p className="eyebrow">{fixture.manufacturer || "Manufacturer pending"}</p>
          <h1>{fixture.name}</h1>
          <p>{fixture.fixture_type || "Fixture type pending"}</p>
        </div>
        <StatusPill status={fixture.status} />
      </section>

      <section className="answer-card">
        <div className="answer-card__header"><CheckCircle2 size={20} /><span>LDG answer first</span></div>
        <div className="answer-grid">
          <div><span>Preferred mode</span><strong>{fixture.preferred_mode || "Not yet verified"}</strong></div>
          <div><span>DMX footprint</span><strong>{fixture.dmx_footprint ? `${fixture.dmx_footprint} channels` : "Not set"}</strong></div>
          <div><span>Typical use</span><strong>{fixture.typical_use || "Not set"}</strong></div>
          <div><span>Last verified</span><strong>{formatDate(fixture.last_verified_at)}</strong></div>
        </div>
      </section>

      <div className="detail-columns">
        <section className="panel detail-panel">
          <div className="panel__heading"><div><p className="eyebrow">Production notes</p><h2>What the team should know</h2></div></div>
          <div className="detail-notes">
            <div><Zap size={18} /><span><strong>Power</strong>{fixture.power_note || "No power note yet."}</span></div>
            <div><Cable size={18} /><span><strong>Data / control</strong>{fixture.control_note || "No control note yet."}</span></div>
            <div><Lightbulb size={18} /><span><strong>Field notes</strong>{fixture.field_notes || "No verified field note yet."}</span></div>
          </div>
        </section>
        <section className="panel detail-panel">
          <div className="panel__heading"><div><p className="eyebrow">Source material</p><h2>Reference links</h2></div></div>
          <div className="reference-links">
            {fixture.dmx_chart_url && <a href={fixture.dmx_chart_url} target="_blank" rel="noreferrer"><FileText size={18} /><span><strong>DMX chart</strong>Open authoritative chart</span><ArrowUpRight size={16} /></a>}
            {fixture.manual_url && <a href={fixture.manual_url} target="_blank" rel="noreferrer"><BookOpen size={18} /><span><strong>Manufacturer manual</strong>Open external reference</span><ArrowUpRight size={16} /></a>}
            {!fixture.dmx_chart_url && !fixture.manual_url && <p className="compact-empty">No source links have been attached yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
