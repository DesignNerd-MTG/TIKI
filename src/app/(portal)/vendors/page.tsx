import type { Metadata } from "next";
import Link from "next/link";
import { Building2, ChevronLeft, ChevronRight, LockKeyhole, Plus, Search } from "lucide-react";
import { DatabaseNotice, EmptyState, PageHeader, StatusPill } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { vendorSort, type VendorDirectoryRecord } from "@/lib/vendor-directory";

export const metadata: Metadata = { title: "Vendors / Manufacturers" };
const pageSize = 30;
const sortLabels = { "name-asc": "Name A–Z", "name-desc": "Name Z–A", "city-asc": "City A–Z", "city-desc": "City Z–A" } as const;

function href(params: { q: string; sort: string; view: string; page?: number }) {
  const search = new URLSearchParams();
  if (params.q) search.set("q", params.q);
  search.set("sort", params.sort);
  if (params.view === "archived") search.set("view", "archived");
  if (params.page && params.page > 1) search.set("page", String(params.page));
  return `/vendors?${search}`;
}

export default async function VendorsPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string; view?: string; page?: string }> }) {
  await requireActiveProfile("editor");
  const params = await searchParams;
  const q = String(params.q ?? "").trim().slice(0, 100);
  const sort = vendorSort(params.sort);
  const view = params.view === "archived" ? "archived" : "current";
  const page = Math.max(1, Number.parseInt(String(params.page ?? "1"), 10) || 1);
  const client = await createClient();
  const result = await client.rpc("vendor_directory", { search_text: q, sort_order: sort, result_offset: (page - 1) * pageSize, result_limit: pageSize, archived: view === "archived" });
  const rows = (result.data ?? []) as VendorDirectoryRecord[];
  const total = Number(rows[0]?.total_count ?? 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const actions = <div className="page-actions"><Link className="secondary-button" href={href({ q, sort, view: view === "archived" ? "current" : "archived" })}>{view === "archived" ? "Current organizations" : "Archived"}</Link><Link className="primary-button" href="/vendors/new"><Plus size={16} /> Add organization</Link><span className="restricted-badge"><LockKeyhole size={15} /> Editor access</span></div>;
  return <div className="page-stack vendor-directory-page">
    <PageHeader eyebrow="Restricted directory" title={view === "archived" ? "Archived vendors / manufacturers" : "Vendors / Manufacturers"} description="Find a company, see its city, and know who to call." action={actions} />
    <form className="vendor-directory-controls" action="/vendors" method="get">
      <label><span className="sr-only">Search organizations and contacts</span><Search size={17} /><input type="search" name="q" defaultValue={q} placeholder="Search organization, city, or contact…" maxLength={100} /></label>
      <label><span>Sort</span><select name="sort" defaultValue={sort}>{Object.entries(sortLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
      {view === "archived" && <input type="hidden" name="view" value="archived" />}<button className="secondary-button">Apply</button>
    </form>
    {result.error ? <DatabaseNotice /> : rows.length ? <section className="vendor-directory-list" aria-label="Vendors and manufacturers">{rows.map((record) => <VendorRow record={record} key={record.id} />)}</section> : <EmptyState icon={Building2} title={q ? "No matching organizations" : "No organizations yet"} description={q ? "Try a broader organization, city, contact name, title, or email." : "Add the first vendor, manufacturer, or retained client record."} />}
    {total > pageSize && <nav className="pagination" aria-label="Vendor pages"><Link className={`secondary-button ${page <= 1 ? "is-disabled" : ""}`} aria-disabled={page <= 1} href={href({ q, sort, view, page: Math.max(1, page - 1) })}><ChevronLeft size={15} /> Previous</Link><span>Page {page} of {pages} · {total} organizations</span><Link className={`secondary-button ${page >= pages ? "is-disabled" : ""}`} aria-disabled={page >= pages} href={href({ q, sort, view, page: Math.min(pages, page + 1) })}>Next <ChevronRight size={15} /></Link></nav>}
  </div>;
}

function VendorRow({ record }: { record: VendorDirectoryRecord }) {
  const primary = record.contacts.find((contact) => contact.is_primary);
  const additional = record.contacts.length - (primary ? 1 : 0);
  return <Link href={`/vendors/${record.id}`} className="vendor-directory-row"><div className="vendor-directory-row__org"><h2>{record.name}</h2><p>{record.city || "City not set"} · {record.kind === "client" ? "Client" : record.kind === "manufacturer" ? "Manufacturer" : "Vendor"}</p></div><div className="vendor-directory-row__contact">{primary ? <><strong>{primary.name}{primary.title ? ` · ${primary.title}` : ""}</strong><span>{[primary.email, primary.cell].filter(Boolean).join(" · ") || "No email or cell"}</span></> : <span>No primary contact selected.</span>}{additional > 0 && <small>+ {additional} additional contact{additional === 1 ? "" : "s"}</small>}</div><StatusPill status={record.status} /><ChevronRight size={17} /></Link>;
}
