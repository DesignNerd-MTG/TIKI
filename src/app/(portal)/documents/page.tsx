import type { Metadata } from "next";
import { FileText } from "lucide-react";

import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("id,title,document_type,url,description,status,updated_at")
    .order("updated_at", { ascending: false });

  const records = (data ?? []).map((document) => ({
    id: document.id,
    title: document.title,
    meta: document.document_type || "Reference document",
    detail: document.description,
    status: document.status,
    date: document.updated_at,
    href: document.url,
    external: true,
  }));

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Published knowledge" title="Documents" description="A searchable index of authoritative manuals, charts, paperwork, and external document locations." />
      {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
        <EmptyState icon={FileText} title="No documents indexed yet" description="Start with links to authoritative files; storage and uploads can come after the indexing workflow works." />
      )}
    </div>
  );
}
