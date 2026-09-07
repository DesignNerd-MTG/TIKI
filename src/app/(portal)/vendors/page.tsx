import type { Metadata } from "next";
import { Building2, LockKeyhole } from "lucide-react";

import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Vendors & Clients" };

export default async function VendorsPage() {
  await requireActiveProfile("editor");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vendor_clients")
    .select("id,name,kind,primary_contact,notes,status,updated_at")
    .order("name");

  const records = (data ?? []).map((item) => ({
    id: item.id,
    title: item.name,
    meta: [item.kind, item.primary_contact].filter(Boolean).join(" · "),
    detail: item.notes,
    status: item.status,
    date: item.updated_at,
  }));

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Restricted area" title="Vendors & clients" description="Sensitive operational context for editors and administrators only." action={<span className="restricted-badge"><LockKeyhole size={15} /> Editor access</span>} />
      {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
        <EmptyState icon={Building2} title="Restricted area is ready" description="Keep this shell empty until authentication, activation, roles, and row-level security have been tested with real accounts." />
      )}
    </div>
  );
}
