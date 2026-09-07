import Link from "next/link";
import { ClipboardPenLine, Layers3 } from "lucide-react";

import { ContentEditor } from "@/components/content-editor";
import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { getRecordDetail, getRecordMeta, getRecordTitle } from "@/lib/content";
import { allowedStatuses } from "@/lib/content-rules";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ManagedRecord } from "@/lib/types";

function queueRecords(records: ManagedRecord[]) {
  return records.map((record) => ({
    id: record.id,
    title: getRecordTitle("napkin", record),
    meta: getRecordMeta("napkin", record),
    detail: getRecordDetail("napkin", record),
    status: String(record.status),
    date: record.updated_at,
    href: `/napkin/${record.id}`,
  }));
}

export async function NapkinCapturePage() {
  const { profile } = await requireActiveProfile();
  const action = <Link className="secondary-button" href="/napkin/pile"><Layers3 size={16} /> Pile of Napkins</Link>;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Quick capture"
        title="T.I.K.I. Napkin"
        description="Store the useful thought now. It can be reviewed and filed into the knowledge base later."
        action={action}
      />
      <section className="panel editor-panel napkin-capture">
        <div className="panel__heading"><div><p className="eyebrow">Stored automatically</p><h2>Throw it on the Napkin</h2></div></div>
        <ContentEditor kind="napkin" statuses={allowedStatuses(profile.role, "napkin")} />
      </section>
    </div>
  );
}

export async function NapkinQueuePage() {
  await requireActiveProfile("editor");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("napkin_notes")
    .select("*")
    .in("status", ["raw", "needs_review"])
    .order("urgent", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(200);
  const records = (data ?? []) as ManagedRecord[];
  const underReview = queueRecords(records.filter((record) => record.status === "needs_review"));
  const stored = queueRecords(records.filter((record) => record.status === "raw"));
  const action = <Link className="secondary-button" href="/napkin/pile"><Layers3 size={16} /> Browse the pile</Link>;

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Editor queue"
        title="Napkin Queue"
        description="Review stored notes, move useful material forward, and file organized knowledge without turning T.I.K.I. into a task list."
        action={action}
      />
      {error ? <DatabaseNotice /> : (
        <div className="search-groups">
          <section>
            <div className="section-heading"><div><p className="eyebrow">{underReview.length} waiting</p><h2>Under review</h2></div></div>
            {underReview.length ? <RecordList records={underReview} /> : <EmptyState title="Nothing under review" description="Move a stored Napkin here when it needs an editorial decision." />}
          </section>
          <section>
            <div className="section-heading"><div><p className="eyebrow">{stored.length} stored</p><h2>Stored pile</h2></div></div>
            {stored.length ? <RecordList records={stored} /> : <EmptyState icon={ClipboardPenLine} title="The pile is clear" description="Newly captured Napkins will appear here automatically." />}
          </section>
        </div>
      )}
    </div>
  );
}
