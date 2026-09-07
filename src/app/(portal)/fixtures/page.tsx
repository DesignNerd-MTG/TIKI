import type { Metadata } from "next";
import { Boxes } from "lucide-react";

import { DatabaseNotice, EmptyState, PageHeader, RecordList } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Fixtures" };

export default async function FixturesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select("id,name,manufacturer,fixture_type,preferred_mode,status,updated_at")
    .order("name");

  const records = (data ?? []).map((fixture) => ({
    id: fixture.id,
    title: fixture.name,
    meta: [fixture.manufacturer, fixture.fixture_type].filter(Boolean).join(" · ") || "Fixture details pending",
    detail: fixture.preferred_mode ? `LDG preferred mode: ${fixture.preferred_mode}` : "Preferred mode not yet verified",
    status: fixture.status,
    date: fixture.updated_at,
    href: `/fixtures/${fixture.id}`,
  }));

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Published knowledge" title="Fixture library" description="Answer-first fixture references: preferred modes, DMX charts, documents, and field-proven notes." />
      {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
        <EmptyState icon={Boxes} title="No fixtures published yet" description="Once editors add and verify fixtures, the library will collect them here." />
      )}
    </div>
  );
}
