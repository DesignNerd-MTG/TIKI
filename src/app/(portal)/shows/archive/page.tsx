import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, DatabaseNotice, StatusPill } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/format";
import { readShowPeople, orderShowPeople } from "@/lib/show-details";
import { buildSearchPattern } from "@/lib/content-validation";

export const metadata: Metadata = { title: "Production archive" };
type Params = { q?: string; year?: string; sort?: string; page?: string; status?: string };

export default async function ProductionArchive({ searchParams }: { searchParams: Promise<Params> }) {
  await requireActiveProfile("viewer");
  const params = await searchParams;
  const supabase = await createClient();
  const q = (params.q ?? "").slice(0, 100);
  const year = /^\d{4}$/.test(params.year ?? "") && Number(params.year) >= 1 && Number(params.year) < 9999 ? params.year! : "";
  const page = Math.min(100000, Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1));
  const sort = ["newest", "oldest", "title", "client"].includes(params.sort ?? "") ? params.sort! : "newest";
  const status = ["published", "draft", "submitted", "archived"].includes(params.status ?? "") ? params.status! : "";
  let query = supabase.from("show_production_history").select("id,title,start_date,end_date,client_name,producer,network_brand,primary_location_id,primary_location_name,primary_city,primary_region,location,studio_site,key_personnel,google_photos_url,summary,status", { count: "exact" });
  if (q.trim()) query = query.ilike("search_text", buildSearchPattern(q));
  // Include productions that overlap the year, including shows with only an end date.
  if (year) query = query.or(`and(start_date.lte.${year}-12-31,end_date.gte.${year}-01-01),and(start_date.gte.${year}-01-01,start_date.lte.${year}-12-31),and(start_date.is.null,end_date.gte.${year}-01-01,end_date.lte.${year}-12-31)`);
  if (status) query = query.eq("status", status);
  query = sort === "title" ? query.order("title") : sort === "client" ? query.order("client_name", { nullsFirst: false }).order("title") : query.order("start_date", { ascending: sort === "oldest", nullsFirst: false });
  const { data, error, count } = await query.order("id").range((page - 1) * 50, page * 50 - 1);
  function pageLink(next: number) { const p = new URLSearchParams({ q, year, sort, status, page: String(next) }); return `/shows/archive?${p}`; }
  return <div className="page-stack">
    <Link className="back-link" href="/shows">← Shows</Link>
    <PageHeader eyebrow="Production history" title="Production archive" description="The same Shows, arranged for remembering. Browse every production you can access; use the year filter to revisit a season." />
    <form className="panel content-form" method="get">
      <div className="content-form__grid">
        <label className="form-field form-field--wide"><span>Search production history</span><input name="q" type="search" defaultValue={q} maxLength={100} placeholder="Show, client, producer, brand, people, location, tags or notes" /></label>
        <label className="form-field"><span>Year</span><input name="year" type="number" min="1" max="9998" defaultValue={year} placeholder="All years" /></label>
        <label className="form-field"><span>Sort</span><select name="sort" defaultValue={sort}><option value="newest">Newest production first</option><option value="oldest">Oldest production first</option><option value="title">Show A–Z</option><option value="client">Client A–Z</option></select></label>
        <label className="form-field"><span>Publication status</span><select name="status" defaultValue={status}><option value="">All permitted records</option><option value="published">Published</option><option value="draft">Draft</option><option value="submitted">Awaiting approval</option><option value="archived">Archived</option></select></label>
      </div>
      <div className="page-actions"><button className="primary-button" type="submit">Search archive</button><Link className="secondary-button" href="/shows/archive">Clear filters</Link></div>
    </form>
    {error ? <DatabaseNotice /> : <>
      <p className="form-intro">{count ?? 0} production{count === 1 ? "" : "s"} · Page {page} of {Math.max(1, Math.ceil((count ?? 0) / 50))}. Historical Shows do not need to be marked Archived.</p>
      {!data?.length ? <div className="panel detail-panel">No productions match these filters.</div> : <div className="production-archive-table" role="region" aria-label="Production archive results" tabIndex={0}>
        <table><thead><tr>{["Show", "Dates", "Client", "Producer", "Network / Brand", "Primary Location", "City", "Key People", "Google Photos", "Notes"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{data.map((show) => <tr key={show.id}>
            <th scope="row"><Link href={`/shows/${show.id}`}>{show.title}</Link><StatusPill status={show.status} /></th>
            <td>{show.start_date ? formatDate(show.start_date) : "Undated"}{show.end_date && <> – {formatDate(show.end_date)}</>}</td>
            <td>{show.client_name || "—"}</td><td>{show.producer || "—"}</td><td>{show.network_brand || "—"}</td>
            <td>{show.primary_location_name ? <Link href={`/locations/${show.primary_location_id}`}>{show.primary_location_name}</Link> : show.primary_location_id ? "Location unavailable" : show.studio_site ? `${show.studio_site} (legacy)` : "—"}</td>
            <td>{[show.primary_city, show.primary_region].filter(Boolean).join(", ") || (!show.primary_location_id && show.location ? `${show.location} (legacy)` : "—")}</td>
            <td>{orderShowPeople(readShowPeople(show.key_personnel)).map((person) => person.name).join(", ") || "—"}</td>
            <td>{show.google_photos_url ? <a href={show.google_photos_url} target="_blank" rel="noreferrer">Open album ↗</a> : "—"}</td>
            <td>{show.summary ? <details><summary>Show notes</summary><p>{show.summary}</p></details> : "—"}</td>
          </tr>)}</tbody>
        </table>
      </div>}
      <nav className="page-actions" aria-label="Archive pages">{page > 1 && <Link className="secondary-button" href={pageLink(page - 1)}>Previous</Link>}{page * 50 < (count ?? 0) && <Link className="secondary-button" href={pageLink(page + 1)}>Next</Link>}</nav>
    </>}
  </div>;
}
