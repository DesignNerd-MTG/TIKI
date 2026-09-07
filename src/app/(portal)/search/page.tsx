import type { Metadata } from "next";
import { Boxes, BookOpenText, FileText, Link2, Search } from "lucide-react";

import { EmptyState, PageHeader, RecordList } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search" };

type SearchRecord = {
  id: string;
  title: string;
  meta: string;
  detail?: string | null;
  href?: string | null;
  external?: boolean;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  let groups: Array<{ label: string; icon: typeof Boxes; records: SearchRecord[] }> = [];

  if (query) {
    const safeQuery = query.replace(/[,%()]/g, " ");
    const pattern = `%${safeQuery}%`;
    const supabase = await createClient();
    const [fixtures, shows, documents, links] = await Promise.all([
      supabase.from("fixtures").select("id,name,manufacturer,preferred_mode").or(`name.ilike.${pattern},manufacturer.ilike.${pattern},preferred_mode.ilike.${pattern}`).limit(12),
      supabase.from("shows").select("id,title,client_name,location,primary_link").or(`title.ilike.${pattern},client_name.ilike.${pattern},location.ilike.${pattern}`).limit(12),
      supabase.from("documents").select("id,title,document_type,description,url").or(`title.ilike.${pattern},document_type.ilike.${pattern},description.ilike.${pattern}`).limit(12),
      supabase.from("link_items").select("id,label,category,description,url").or(`label.ilike.${pattern},category.ilike.${pattern},description.ilike.${pattern}`).limit(12),
    ]);

    groups = [
      {
        label: "Fixtures",
        icon: Boxes,
        records: (fixtures.data ?? []).map((item) => ({ id: item.id, title: item.name, meta: item.manufacturer || "Fixture", detail: item.preferred_mode ? `Preferred mode: ${item.preferred_mode}` : null, href: `/fixtures/${item.id}` })),
      },
      {
        label: "Shows",
        icon: BookOpenText,
        records: (shows.data ?? []).map((item) => ({ id: item.id, title: item.title, meta: [item.client_name, item.location].filter(Boolean).join(" · ") || "Show", href: item.primary_link, external: Boolean(item.primary_link) })),
      },
      {
        label: "Documents",
        icon: FileText,
        records: (documents.data ?? []).map((item) => ({ id: item.id, title: item.title, meta: item.document_type || "Document", detail: item.description, href: item.url, external: true })),
      },
      {
        label: "Links",
        icon: Link2,
        records: (links.data ?? []).map((item) => ({ id: item.id, title: item.label, meta: item.category, detail: item.description, href: item.url, external: true })),
      },
    ].filter((group) => group.records.length);
  }

  const resultCount = groups.reduce((total, group) => total + group.records.length, 0);

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Global search" title={query ? `Results for “${query}”` : "Search T.I.K.I."} description={query ? `${resultCount} result${resultCount === 1 ? "" : "s"} across the knowledge index.` : "Search fixtures, shows, documents, and links from one place."} />
      <form className="search-page-form" action="/search" method="get">
        <Search size={20} />
        <input name="q" defaultValue={query} autoFocus placeholder="What are you looking for?" aria-label="Search query" />
        <button className="primary-button" type="submit">Search</button>
      </form>
      {!query ? (
        <EmptyState icon={Search} title="Start with a useful noun" description="Try a fixture name, manufacturer, show, client, document type, or link category." />
      ) : groups.length ? (
        <div className="search-groups">
          {groups.map((group) => {
            const Icon = group.icon;
            return (
              <section key={group.label}>
                <div className="section-heading"><div><p className="eyebrow">{group.records.length} found</p><h2><Icon size={20} /> {group.label}</h2></div></div>
                <RecordList records={group.records} />
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState title="No matches yet" description="Try a broader term. Search currently checks the published fixture, show, document, and link fields." />
      )}
    </div>
  );
}
