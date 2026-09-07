import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole, Plus, Tags } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { ArchiveButton, ContentEditor, DeleteButton, FileNapkinControl } from "@/components/content-editor";
import { DatabaseNotice, EmptyState, PageHeader, RecordList, StatusPill } from "@/components/ui";
import { contentConfigs, getRecordDetail, getRecordMeta, getRecordTitle } from "@/lib/content";
import { allowedStatuses, canArchiveContent, canCreateContent, canDeleteContent, canEditContent } from "@/lib/content-rules";
import { requireActiveProfile } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { EntityKind, ManagedRecord } from "@/lib/types";

function stringify(value: unknown) {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

async function getTags(kind: EntityKind, id: string) {
  const supabase = await createClient();
  const links = await supabase.from("content_tags").select("tag_id").eq("entity_kind", kind).eq("entity_id", id);
  const ids = (links.data ?? []).map((item) => item.tag_id);
  if (!ids.length) return [];
  const result = await supabase.from("tags").select("name").in("id", ids).order("name");
  return (result.data ?? []).map((tag) => tag.name);
}

export async function ContentIndexPage({
  kind,
  searchParams,
  icon,
  inlineCreate = false,
  title,
  eyebrow,
  description,
  createLabel,
  listRoute,
  createRoute,
}: {
  kind: EntityKind;
  searchParams?: Promise<{ view?: string; deleted?: string }>;
  icon?: LucideIcon;
  inlineCreate?: boolean;
  title?: string;
  eyebrow?: string;
  description?: string;
  createLabel?: string;
  listRoute?: string;
  createRoute?: string;
}) {
  const config = contentConfigs[kind];
  const browseRoute = listRoute ?? config.route;
  const [{ profile }, params, supabase] = await Promise.all([
    requireActiveProfile(config.restricted ? "editor" : "viewer"),
    searchParams ?? Promise.resolve<{ view?: string; deleted?: string }>({}),
    createClient(),
  ]);
  const showArchived = params.view === "archived" && (profile.role === "editor" || profile.role === "admin");
  let query = supabase.from(config.table).select("*").order("updated_at", { ascending: false });
  query = showArchived ? query.eq("status", "archived") : query.neq("status", "archived");
  const { data, error } = await query.limit(100);
  const records = ((data ?? []) as ManagedRecord[]).map((record) => ({
    id: record.id,
    title: getRecordTitle(kind, record),
    meta: getRecordMeta(kind, record),
    detail: getRecordDetail(kind, record),
    status: String(record.status),
    date: record.updated_at,
    href: `${config.route}/${record.id}`,
  }));
  const mayCreate = canCreateContent(profile.role, kind);
  const mayReviewArchive = profile.role === "editor" || profile.role === "admin";

  const actions = (
    <div className="page-actions">
      {mayReviewArchive && <Link className="secondary-button" href={showArchived ? browseRoute : `${browseRoute}?view=archived`}>{showArchived ? "Current records" : "Archived"}</Link>}
      {mayCreate && !inlineCreate && <Link className="primary-button" href={createRoute ?? `${config.route}/new`}><Plus size={16} /> {createLabel ?? `Add ${config.singular.toLowerCase()}`}</Link>}
      {config.restricted && <span className="restricted-badge"><LockKeyhole size={15} /> Editor access</span>}
    </div>
  );

  return (
    <div className="page-stack">
      <PageHeader eyebrow={eyebrow ?? config.eyebrow} title={showArchived ? `Archived ${(title ?? config.plural).toLowerCase()}` : (title ?? config.plural)} description={description ?? config.description} action={actions} />
      {params.deleted && <div className="notice notice--success">The record was permanently deleted.</div>}
      {inlineCreate && mayCreate && (
        <section className="panel editor-panel">
          <div className="panel__heading"><div><p className="eyebrow">Quick capture</p><h2>Throw it on the Napkin</h2></div></div>
          <ContentEditor kind={kind} statuses={allowedStatuses(profile.role, kind)} />
        </section>
      )}
      <section>
        {inlineCreate && <div className="section-heading"><div><p className="eyebrow">Captured notes</p><h2>Your intake queue</h2></div></div>}
        {error ? <DatabaseNotice /> : records.length ? <RecordList records={records} /> : (
          <EmptyState icon={icon} title={showArchived ? "No archived records" : `No ${config.plural.toLowerCase()} yet`} description={mayCreate ? `Create the first ${config.singular.toLowerCase()} when useful information is ready.` : "Published records will appear here when contributors and editors add them."} />
        )}
      </section>
    </div>
  );
}

export async function ContentCreatePage({ kind }: { kind: EntityKind }) {
  const config = contentConfigs[kind];
  const { profile } = await requireActiveProfile(config.minimumCreateRole);
  return (
    <div className="page-stack">
      <Link className="back-link" href={config.route}><ArrowLeft size={16} /> Back to {config.plural.toLowerCase()}</Link>
      <PageHeader eyebrow="New record" title={`Add ${config.singular.toLowerCase()}`} description={profile.role === "admin" ? "Administrator entries publish immediately unless you choose another status." : "Start with what is known. Drafts can be refined and submitted for review later."} />
      <section className="panel editor-panel"><ContentEditor kind={kind} statuses={allowedStatuses(profile.role, kind)} defaultStatus={profile.role === "admin" ? "published" : undefined} /></section>
    </div>
  );
}

export async function ContentDetailPage({
  kind,
  id,
  saved,
}: {
  kind: EntityKind;
  id: string;
  saved?: string;
}) {
  const config = contentConfigs[kind];
  const [{ identity, profile }, supabase] = await Promise.all([
    requireActiveProfile(config.restricted ? "editor" : "viewer"),
    createClient(),
  ]);
  const result = await supabase.from(config.table).select("*").eq("id", id).maybeSingle();
  if (!result.data) notFound();
  const record = result.data as ManagedRecord;
  const [tags, revisionsResult] = await Promise.all([
    getTags(kind, id),
    supabase.from("revision_notes").select("id,summary,source,created_at").eq("entity_kind", kind).eq("entity_id", id).order("created_at", { ascending: false }).limit(30),
  ]);
  const mayEdit = canEditContent(profile.role, identity.id, kind, record);
  const mayArchive = record.status !== "archived" && canArchiveContent(profile.role, identity.id, kind, record);
  const title = getRecordTitle(kind, record);
  const externalFields = config.fields.filter((field) => field.type === "url" && stringify(record[field.name]));
  const detailFields = config.fields.filter((field) => (kind === "napkin" || field.name !== config.titleField) && field.type !== "url" && stringify(record[field.name]));
  const filingKind = typeof record.converted_to_kind === "string" && record.converted_to_kind in contentConfigs && record.converted_to_kind !== "napkin" ? record.converted_to_kind as EntityKind : null;
  const filingId = typeof record.converted_to_id === "string" ? record.converted_to_id : null;
  const filingDestination = filingKind && filingId ? { config: contentConfigs[filingKind], href: `${contentConfigs[filingKind].route}/${filingId}` } : null;
  const canFileNapkin = kind === "napkin" && mayEdit && (record.status === "raw" || record.status === "needs_review");
  const backRoute = kind === "napkin" ? "/napkin/pile" : config.route;

  return (
    <div className="page-stack">
      <Link className="back-link" href={backRoute}><ArrowLeft size={16} /> Back to {kind === "napkin" ? "the pile" : config.plural.toLowerCase()}</Link>
      {saved && <div className="notice notice--success">{saved === "filed" ? "Approved, published, and filed from its original Napkin." : "Created and ready for the next pass."}</div>}
      <section className="detail-hero">
        <div><p className="eyebrow">{getRecordMeta(kind, record)}</p><h1>{title}</h1><p>Updated {formatDate(record.updated_at)}</p></div>
        <div className="detail-hero__actions"><StatusPill status={String(record.status)} />{mayArchive && <ArchiveButton kind={kind} id={id} />}{record.status === "archived" && canDeleteContent(profile.role) && <DeleteButton kind={kind} id={id} label={title} />}</div>
      </section>

      {tags.length > 0 && <div className="tag-list" aria-label="Tags"><Tags size={15} />{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}

      {filingDestination && <div className="notice notice--success">Filed as <Link href={filingDestination.href}>{filingDestination.config.singular}: open the published record</Link>.</div>}

      {canFileNapkin && <FileNapkinControl id={id} suggestedTitle={title} hasSourceUrl={Boolean(stringify(record.source_url))} />}

      <div className="detail-columns">
        <section className="panel detail-panel">
          <div className="panel__heading"><div><p className="eyebrow">Record details</p><h2>What the team should know</h2></div></div>
          <dl className="detail-definition-list">
            {detailFields.map((field) => <div key={field.name}><dt>{field.label}</dt><dd>{stringify(record[field.name])}</dd></div>)}
            {!detailFields.length && <div className="compact-empty">No additional details have been recorded yet.</div>}
          </dl>
        </section>
        <section className="panel detail-panel">
          <div className="panel__heading"><div><p className="eyebrow">Source material</p><h2>Authoritative links</h2></div></div>
          <div className="reference-links">
            {externalFields.map((field) => <a href={stringify(record[field.name])} target="_blank" rel="noreferrer" key={field.name}><span><strong>{field.label}</strong>{stringify(record[field.name])}</span><ArrowUpRight size={16} /></a>)}
            {!externalFields.length && <p className="compact-empty">No external source links have been attached.</p>}
          </div>
        </section>
      </div>

      <section className="panel detail-panel">
        <div className="panel__heading"><div><p className="eyebrow">Audit trail</p><h2>Revision notes</h2></div></div>
        <div className="revision-list">
          {(revisionsResult.data ?? []).map((revision) => <article key={revision.id}><p>{revision.summary}</p><time dateTime={revision.created_at}>{formatDate(revision.created_at)}</time></article>)}
          {!revisionsResult.data?.length && <p className="compact-empty">No revision notes yet.</p>}
        </div>
      </section>

      {mayEdit ? (
        <section className="panel editor-panel">
          <div className="panel__heading"><div><p className="eyebrow">Role-aware controls</p><h2>Edit {config.singular.toLowerCase()}</h2></div></div>
          <ContentEditor key={`${record.id}:${record.updated_at}`} kind={kind} record={record} tags={tags} statuses={allowedStatuses(profile.role, kind)} />
        </section>
      ) : (
        <div className="notice notice--neutral">This record is read-only for your current role.</div>
      )}
    </div>
  );
}
