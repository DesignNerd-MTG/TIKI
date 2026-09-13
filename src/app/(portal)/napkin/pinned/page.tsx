import type { Metadata } from "next";
import Link from "next/link";
import { Pin } from "lucide-react";
import { MemberAvatar } from "@/components/member-avatar";
import { DatabaseNotice, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { ManagedRecord } from "@/lib/types";

export const metadata: Metadata = { title: "Pinned Napkins" };

export default async function PinnedNapkinsPage() {
  await requireActiveProfile();
  const client = await createClient();
  const result = await client.from("napkin_notes").select("id,body,status,urgent,pinned,created_by,created_at,updated_at").eq("pinned", true).order("updated_at", { ascending: false }).limit(200);
  const records = (result.data ?? []) as ManagedRecord[];
  const authorIds = [...new Set(records.map((record) => String(record.created_by ?? "")).filter(Boolean))];
  const identities = authorIds.length ? await client.rpc("napkin_poster_identities", { target_ids: authorIds }) : { data: [], error: null };
  const names = new Map<string,string>((identities.data ?? []).map((item: { profile_id: string; display_name: string }) => [item.profile_id, item.display_name]));
  const failed = result.error || identities.error;

  return <div className="page-stack pinned-napkins-page">
    <PageHeader eyebrow="Working knowledge" title="Pinned Napkins" description="A compact wall of the Napkins worth keeping close at hand." />
    {failed ? <DatabaseNotice /> : records.length ? <section className="pinned-napkin-wall" aria-label="Pinned Napkins">
      {records.map((record, index) => {
        const authorId = String(record.created_by ?? "");
        const name = names.get(authorId) ?? "T.I.K.I. member";
        const body = String(record.body ?? "");
        return <Link className={`pinned-napkin pinned-napkin--${index % 3}`} href={`/napkin/${record.id}`} key={record.id}>
          <span className="pinned-napkin__pin" aria-hidden="true"><Pin size={15} fill="currentColor" /></span>
          <h2>{body.length > 72 ? `${body.slice(0, 72)}…` : body}</h2>
          <p>{body.length > 180 ? `${body.slice(0, 180)}…` : body}</p>
          <footer><MemberAvatar id={authorId} name={name} /><span><strong>{name}</strong><time dateTime={String(record.created_at)}>{formatDate(String(record.created_at))}</time></span><StatusPill status={String(record.status)} /></footer>
        </Link>;
      })}
    </section> : <EmptyState icon={Pin} title="No pinned Napkins yet" description="Pin an editable Napkin from its normal detail page and it will appear here." />}
  </div>;
}
