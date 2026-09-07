import type { Metadata } from "next";
import { ClipboardPenLine, Send, Sparkles } from "lucide-react";

import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "T.I.K.I. Napkin" };

export default async function NapkinPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const [params, supabase] = await Promise.all([searchParams, createClient()]);
  const { data, error } = await supabase
    .from("napkin_notes")
    .select("id,body,source_url,urgent,status,created_at")
    .order("created_at", { ascending: false })
    .limit(40);

  const records = (data ?? []).map((note) => ({
    id: note.id,
    title: note.body.length > 92 ? `${note.body.slice(0, 92)}…` : note.body,
    meta: note.urgent ? "Urgent field note" : "Unsorted working knowledge",
    detail: note.source_url,
    status: note.status,
    date: note.created_at,
    href: note.source_url,
    external: Boolean(note.source_url),
  }));

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Working knowledge" title="T.I.K.I. Napkin" description="A forgiving landing place for useful information that is not clean, classified, or verified yet." />

      <section className="napkin-capture">
        <div className="napkin-capture__intro"><span><Sparkles size={18} /></span><div><h2>Throw it on the Napkin.</h2><p>Dump a warning, link, reminder, or half-formed thought. Editors can sort it out later.</p></div></div>
        {params.saved && <div className="notice notice--success">Saved. The thought is out of your head and in T.I.K.I.</div>}
        {params.error && <div className="notice notice--error">That note could not be saved. Add some text and try again.</div>}
        <form className="napkin-form" action="/napkin/new" method="post">
          <label htmlFor="napkin-body">What should we remember?</label>
          <textarea id="napkin-body" name="body" rows={4} maxLength={4000} required placeholder="Pretty sure the profile we used on that beach show was better than the old file. Ask Sean before publishing…" />
          <div className="napkin-form__row">
            <input name="source_url" type="url" placeholder="Optional source link" aria-label="Optional source link" />
            <label className="check-control"><input name="urgent" type="checkbox" value="true" /> Mark important</label>
            <button className="primary-button" type="submit">Save Napkin <Send size={16} /></button>
          </div>
        </form>
      </section>

      <section>
        <div className="section-heading"><div><p className="eyebrow">Captured notes</p><h2>Your intake queue</h2></div></div>
        {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
          <EmptyState icon={ClipboardPenLine} title="The Napkin is clean" description="That probably won’t last. Save the next useful fragment before it evaporates." />
        )}
      </section>
    </div>
  );
}
