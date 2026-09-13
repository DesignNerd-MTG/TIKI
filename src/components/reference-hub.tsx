import Link from "next/link";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { canCreateContent } from "@/lib/content-rules";
import { referenceCollections, referenceCollection } from "@/lib/references";
import { ReferenceResults } from "@/components/reference-results";
import { DatabaseNotice, EmptyState, PageHeader } from "@/components/ui";
import { referenceSort, referenceSorts } from "@/lib/reference-sort";
import type { ManagedRecord } from "@/lib/types";

export type ReferenceParams = { q?: string; collection?: string; subcollection?: string; view?: string; page?: string; sort?: string };
export async function ReferenceHub({ params }: { params: ReferenceParams }) {
  const { profile } = await requireActiveProfile();
  const client = await createClient();
  const query = params.q?.trim().slice(0,100) || "";
  const sort = referenceSort(params.sort);
  const collection = referenceCollection(params.collection);
  const subcollection = referenceCollection(params.subcollection);
  const selected = collection && !collection.parent_id ? collection : null;
  const sub = subcollection?.parent_id === selected?.id ? subcollection : null;
  const archived = params.view === "archived" && ["editor","admin"].includes(profile.role);
  const page = Math.max(0,Math.min(2000, Number.parseInt(params.page || "0",10) || 0));
  const [counts, result] = await Promise.all([
    client.rpc("reference_collection_counts"),
    client.rpc("search_reference_index", { search_text: query, selected_collection: selected?.id ?? null, selected_subcollection: sub?.id ?? null, archived, page_offset: page * 50, sort_order: sort }),
  ]);
  const records = (result.data ?? []) as ManagedRecord[];
  const tagMap = new Map<string,string[]>();
  if (records.length) {
    const tags = await client.from("content_tags").select("entity_id,tags(name)").eq("entity_kind","link").in("entity_id",records.map((row) => row.id));
    for (const row of tags.data ?? []) {
      const nested = row.tags as unknown as { name: string } | Array<{ name: string }>;
      const name = Array.isArray(nested) ? nested[0]?.name : nested?.name;
      if (name) tagMap.set(row.entity_id,[...(tagMap.get(row.entity_id) ?? []),name]);
    }
  }
  const countRows = (counts.data ?? []) as Array<{ collection_id: string; subcollection_id: string | null; reference_count: number }>;
  const cards = selected ? referenceCollections.filter((item) => item.parent_id === selected.id) : referenceCollections.filter((item) => !item.parent_id);
  const href = (number: number) => "/links?" + new URLSearchParams({ q: query, collection: selected?.id ?? "", subcollection: sub?.id ?? "", view: archived ? "archived" : "", page: String(number), sort });
  const sortedLink = (url: string) => url + (url.includes("?") ? "&" : "?") + "sort=" + sort;
  const addReferenceParams = new URLSearchParams();
  if (selected) addReferenceParams.set("collection", selected.id);
  if (sub) addReferenceParams.set("subcollection", sub.id);
  const addReferenceHref = addReferenceParams.size ? `/links/new?${addReferenceParams}` : "/links/new";
  return <div className="page-stack">
    <PageHeader eyebrow="Reference Hub" title={sub?.name ?? selected?.name ?? "Reference Hub"} description={sub?.description ?? selected?.description ?? "Useful references organized by what they help you do."} action={canCreateContent(profile.role,"link") && <Link className="primary-button" href={addReferenceHref}>+ Add Reference</Link>} />
    <nav className="page-actions" aria-label="Reference collections"><Link href={sortedLink("/links")}>All collections</Link><Link href={sortedLink("/links?collection=unsorted")}>Unsorted inbox</Link>{selected && <Link href={sortedLink("/links?collection="+selected.id)}>{selected.name}</Link>}{["editor","admin"].includes(profile.role) && <Link href={sortedLink(archived ? "/links" : "/links?view=archived")}>{archived ? "Current references" : "Archived references"}</Link>}</nav>
    <form className="search-page-form" action="/links"><input type="hidden" name="sort" value={sort} /><input name="q" aria-label="Search references" defaultValue={query} placeholder="Search title, URL, notes, collection, or tags…" maxLength={100} /><input type="hidden" name="collection" value={selected?.id ?? ""} /><input type="hidden" name="subcollection" value={sub?.id ?? ""} /><input type="hidden" name="view" value={archived ? "archived" : ""} /><button className="primary-button">Search</button></form>
    {counts.error || result.error ? <DatabaseNotice /> : <>
      {!query && !archived && !sub && <section className="reference-grid" aria-label="Collections">{cards.map((item) => {
        const count = countRows.filter((row) => item.parent_id ? row.subcollection_id === item.id : row.collection_id === item.id).reduce((sum,row) => sum + Number(row.reference_count),0);
        return <Link className="panel detail-panel reference-collection" href={sortedLink(item.parent_id ? "/links?collection="+item.parent_id+"&subcollection="+item.id : "/links?collection="+item.id)} key={item.id}><h2>{item.name}</h2><p>{item.description}</p><span>{count} references</span></Link>;
      })}</section>}
      <section><div className="section-heading"><h2>{archived ? "Archived references" : query ? "Matching references" : selected ? "References in this collection" : "References"}</h2></div>
        <ReferenceResults records={records.slice(0,50)} tags={Object.fromEntries(tagMap)} sortControl={<form action="/links" className="page-actions reference-sort-control"><input type="hidden" name="q" value={query} /><input type="hidden" name="collection" value={selected?.id ?? ""} /><input type="hidden" name="subcollection" value={sub?.id ?? ""} /><input type="hidden" name="view" value={archived ? "archived" : ""} /><label className="compact-select-control"><span>Sort</span><select name="sort" aria-label="Sort references" defaultValue={sort} key={sort}>{Object.entries(referenceSorts).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><button className="secondary-button">Apply</button></form>} />
        {!records.length && <EmptyState title="No references here yet" description="Save a URL to Unsorted, or choose another collection or search term." />}
      </section>
      <nav className="page-actions" aria-label="Reference pages">{page > 0 && <Link href={href(page-1)}>Previous</Link>}{records.length > 50 && <Link href={href(page+1)}>Next</Link>}</nav>
    </>}
  </div>;
}
