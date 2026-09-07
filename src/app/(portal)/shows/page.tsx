import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";

import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Shows" };

export default async function ShowsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("shows")
    .select("id,title,client_name,location,start_date,primary_link,status,updated_at")
    .order("start_date", { ascending: false });

  const records = (data ?? []).map((show) => ({
    id: show.id,
    title: show.title,
    meta: [show.client_name, show.location].filter(Boolean).join(" · ") || "Show details pending",
    detail: show.start_date ? `Starts ${new Date(show.start_date).toLocaleDateString("en-US")}` : "Dates not yet set",
    status: show.status,
    date: show.updated_at,
    href: show.primary_link,
    external: Boolean(show.primary_link),
  }));

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Published knowledge" title="Shows" description="The clean index above existing show folders, key documents, reference files, and current links." />
      {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
        <EmptyState icon={BookOpenText} title="No shows indexed yet" description="Show records and their authoritative Dropbox links will appear here." />
      )}
    </div>
  );
}
