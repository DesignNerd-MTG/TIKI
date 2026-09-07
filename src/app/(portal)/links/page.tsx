import type { Metadata } from "next";
import { Link2 } from "lucide-react";

import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Link Hub" };

export default async function LinksPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("link_items")
    .select("id,label,category,url,description,status,updated_at")
    .order("category")
    .order("label");

  const records = (data ?? []).map((link) => ({
    id: link.id,
    title: link.label,
    meta: link.category,
    detail: link.description,
    status: link.status,
    date: link.updated_at,
    href: link.url,
    external: true,
  }));

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Daily tools" title="Link Hub" description="Fast routes to timesheets, expenses, software downloads, show folders, and the systems T.I.K.I. indexes." />
      {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
        <EmptyState icon={Link2} title="No links published yet" description="Add the department’s most-used portals first; T.I.K.I. should become the front door." />
      )}
    </div>
  );
}
