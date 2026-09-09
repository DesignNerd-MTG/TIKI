import type { Metadata } from "next";
import { Boxes, BookOpenText, Building2, ClipboardPenLine, FileText, Link2, MapPinned, Martini, PlaneTakeoff, Search, Tags } from "lucide-react";

import { EmptyState, PageHeader, RecordList } from "@/components/ui";
import { contentConfigs, getCountryLabel, getStatusLabel } from "@/lib/content";
import { buildSearchPattern } from "@/lib/content-validation";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { matchesTravelProfileName } from "@/lib/travel-search";
import type { EntityKind } from "@/lib/types";

export const metadata: Metadata = { title: "Search" };

type SearchRecord = { id: string; title: string; meta: string; detail?: string | null; href: string };
type SearchGroup = { label: string; icon: typeof Boxes; records: SearchRecord[] };

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const [{ profile }, params] = await Promise.all([requireActiveProfile(), searchParams]);
  const query = params.q?.trim().slice(0, 100) ?? "";
  const pattern = buildSearchPattern(query);
  let groups: SearchGroup[] = [];
  let searchFailed = false;

  if (pattern) {
    const supabase = await createClient();
    const vendorRequest = profile.role === "editor" || profile.role === "admin"
      ? supabase.from("vendor_clients").select("id,name,kind,primary_contact,notes").neq("status", "archived").or(`name.ilike.${pattern},primary_contact.ilike.${pattern},notes.ilike.${pattern}`).limit(12)
      : Promise.resolve({ data: [], error: null });
    const [fixtures, shows, documents, links, locations, drinks, vendors, napkin, travelProfiles, tagLinks] = await Promise.all([
      supabase.from("fixtures").select("id,name,manufacturer,preferred_mode").neq("status", "archived").or(`name.ilike.${pattern},manufacturer.ilike.${pattern},preferred_mode.ilike.${pattern},field_notes.ilike.${pattern}`).limit(12),
      supabase.from("shows").select("id,title,job_number,client_name,location,summary,staffing_notes").neq("status", "archived").or(`title.ilike.${pattern},job_number.ilike.${pattern},client_name.ilike.${pattern},location.ilike.${pattern},summary.ilike.${pattern},staffing_notes.ilike.${pattern}`).limit(12),
      supabase.from("documents").select("id,title,document_type,description").neq("status", "archived").or(`title.ilike.${pattern},document_type.ilike.${pattern},description.ilike.${pattern}`).limit(12),
      supabase.from("link_items").select("id,label,category,description").neq("status", "archived").or(`label.ilike.${pattern},category.ilike.${pattern},description.ilike.${pattern}`).limit(12),
      supabase.from("locations").select("id,name,kind,address,city,region,country,notes").neq("status", "archived").or(`name.ilike.${pattern},kind.ilike.${pattern},address.ilike.${pattern},city.ilike.${pattern},region.ilike.${pattern},country.ilike.${pattern},notes.ilike.${pattern}`).limit(12),
      supabase.from("drinks").select("id,name,description,ingredients,glassware,garnish").neq("status", "archived").or(`name.ilike.${pattern},description.ilike.${pattern},ingredients.ilike.${pattern},glassware.ilike.${pattern},garnish.ilike.${pattern}`).limit(12),
      vendorRequest,
      supabase.from("napkin_notes").select("id,body,urgent,status").neq("status", "archived").or(`body.ilike.${pattern},source_url.ilike.${pattern}`).limit(12),
      supabase.from("travel_profiles").select("user_id,name").not("name", "is", null).limit(12),
      supabase.from("content_tags").select("entity_kind,entity_id,tags!inner(name)").ilike("tags.name", pattern).limit(20),
    ]);
    searchFailed = [fixtures, shows, documents, links, locations, drinks, vendors, napkin, travelProfiles, tagLinks].some((result) => Boolean(result.error));
    groups = [
      { label: "Fixtures", icon: Boxes, records: (fixtures.data ?? []).map((item) => ({ id: item.id, title: item.name, meta: item.manufacturer || "Fixture", detail: item.preferred_mode ? `Preferred mode: ${item.preferred_mode}` : null, href: `/fixtures/${item.id}` })) },
      { label: "Shows", icon: BookOpenText, records: (shows.data ?? []).map((item) => ({ id: item.id, title: item.title, meta: [item.job_number ? `Job ${item.job_number}` : null, item.client_name, item.location].filter(Boolean).join(" · ") || "Show", detail: item.summary || item.staffing_notes, href: `/shows/${item.id}` })) },
      { label: "Documents", icon: FileText, records: (documents.data ?? []).map((item) => ({ id: item.id, title: item.title, meta: item.document_type || "Document", detail: item.description, href: `/documents/${item.id}` })) },
      { label: "Links", icon: Link2, records: (links.data ?? []).map((item) => ({ id: item.id, title: item.label, meta: item.category, detail: item.description, href: `/links/${item.id}` })) },
      { label: "Locations", icon: MapPinned, records: (locations.data ?? []).map((item) => ({ id: item.id, title: item.name, meta: [item.kind, item.city, item.region, item.country !== "US" ? getCountryLabel(item.country) : null].filter(Boolean).join(" · ") || "Useful place", detail: [item.address, item.notes].filter(Boolean).join(" · "), href: `/locations/${item.id}` })) },
      { label: "Drinks", icon: Martini, records: (drinks.data ?? []).map((item) => ({ id: item.id, title: item.name, meta: [item.glassware, item.garnish].filter(Boolean).join(" · ") || "Cocktail recipe", detail: item.description || item.ingredients, href: `/drinks/${item.id}` })) },
      { label: "Vendors & clients", icon: Building2, records: (vendors.data ?? []).map((item) => ({ id: item.id, title: item.name, meta: item.kind, detail: [item.primary_contact, item.notes].filter(Boolean).join(" · "), href: `/vendors/${item.id}` })) },
      { label: "Napkin", icon: ClipboardPenLine, records: (napkin.data ?? []).map((item) => ({ id: item.id, title: item.body.length > 90 ? `${item.body.slice(0, 90)}…` : item.body, meta: item.urgent ? "Important note" : "Working knowledge", detail: getStatusLabel(item.status), href: `/napkin/${item.id}` })) },
      { label: "Travel Portal", icon: PlaneTakeoff, records: (travelProfiles.data ?? []).filter((item) => matchesTravelProfileName(item.name, query)).map((item) => ({ id: item.user_id, title: `${item.name} Travel Preferences`, meta: "Private travel reference", detail: "Open the Travel Portal", href: "/travel" })) },
      { label: "Tag matches", icon: Tags, records: (tagLinks.data ?? []).map((item) => {
        const kind = item.entity_kind as EntityKind;
        const nested = item.tags as unknown as { name?: string } | Array<{ name?: string }>;
        const name = Array.isArray(nested) ? nested[0]?.name : nested?.name;
        return { id: `${kind}-${item.entity_id}`, title: name || query, meta: `Tagged ${contentConfigs[kind]?.singular?.toLowerCase() ?? "record"}`, detail: "Open the tagged record", href: `${contentConfigs[kind]?.route ?? "/search"}/${item.entity_id}` };
      }) },
    ].filter((group) => group.records.length);
  }

  const resultCount = groups.reduce((total, group) => total + group.records.length, 0);
  return (
    <div className="page-stack">
      <PageHeader eyebrow="Global search" title={query ? `Results for “${query}”` : "Search T.I.K.I."} description={query ? `${resultCount} result${resultCount === 1 ? "" : "s"} across content and tags.` : "Search fixtures, shows, documents, links, locations, drinks, travel-profile names, permitted vendor context, Napkin notes, and tags from one place."} />
      <form className="search-page-form" action="/search" method="get"><Search size={20} /><input name="q" defaultValue={query} autoFocus placeholder="What are you looking for?" aria-label="Search query" maxLength={100} /><button className="primary-button" type="submit">Search</button></form>
      {searchFailed && <div className="notice notice--warning">Some sources could not be searched. The available results are shown below.</div>}
      {!query ? <EmptyState icon={Search} title="Start with a useful noun" description="Try a fixture name, manufacturer, show, client, document type, link category, note, or tag." /> : groups.length ? (
        <div className="search-groups">{groups.map((group) => { const Icon = group.icon; return <section key={group.label}><div className="section-heading"><div><p className="eyebrow">{group.records.length} found</p><h2><Icon size={20} /> {group.label}</h2></div></div><RecordList records={group.records} /></section>; })}</div>
      ) : <EmptyState title="No matches yet" description="Try a broader term or check the spelling. Results remain limited to records your role can read." />}
    </div>
  );
}
