import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, DatabaseZap, SearchX, Tags } from "lucide-react";

import { formatDate } from "@/lib/format";
import { getStatusLabel } from "@/lib/content";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-header__description">{description}</p>
      </div>
      {action && <div className="page-header__action">{action}</div>}
    </header>
  );
}

export function EmptyState({
  title = "Nothing here yet",
  description,
  icon: Icon = SearchX,
}: {
  title?: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon"><Icon size={22} /></span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}

export function DatabaseNotice() {
  return (
    <div className="notice notice--warning">
      <DatabaseZap size={19} aria-hidden="true" />
      <div>
        <strong>The interface is ready, but the database needs its first migration.</strong>
        <span>Run the SQL in Supabase, then refresh this page.</span>
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`status-pill status-pill--${status.replaceAll("_", "-")}`}>{getStatusLabel(status)}</span>;
}

export function RecordList({
  records,
}: {
  records: Array<{
    id: string;
    title: string;
    meta?: string | null;
    detail?: string | null;
    tags?: string[];
    status?: string;
    href?: string | null;
    externalUrl?: string | null;
    date?: string | null;
    external?: boolean;
  }>;
}) {
  return (
    <div className="record-list">
      {records.map((record) => {
        const body = (
          <>
            <div className="record-row__main">
              <div className="record-row__title-line">
                <h2>{record.externalUrl ? <a className="record-row__title-link" href={record.externalUrl} target="_blank" rel="noopener noreferrer">{record.title}<ArrowUpRight size={15} aria-hidden="true" /></a> : record.title}</h2>
                {record.external && <ArrowUpRight size={15} aria-hidden="true" />}
              </div>
              {record.tags && record.tags.length > 0 && <div className="tag-list record-row__tags" aria-label="Tags"><Tags size={14} />{record.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
              {record.meta && <p>{record.meta}</p>}
              {record.detail && <span className="record-row__detail">{record.detail}</span>}
              {record.externalUrl && <a className="record-row__url" href={record.externalUrl} target="_blank" rel="noopener noreferrer">{record.externalUrl}<ArrowUpRight size={14} aria-hidden="true" /></a>}
            </div>
            <div className="record-row__aside">
              {record.status && <StatusPill status={record.status} />}
              {record.date && <time dateTime={record.date}>{formatDate(record.date)}</time>}
              {record.externalUrl && record.href && <Link className="record-row__details-link" href={record.href}>Details</Link>}
            </div>
          </>
        );

        return record.externalUrl ? (
          <article className="record-row record-row--link-hub" key={record.id}>{body}</article>
        ) : record.href ? (
          record.external ? (
            <a className="record-row" href={record.href} target="_blank" rel="noreferrer" key={record.id}>{body}</a>
          ) : (
            <Link className="record-row" href={record.href} key={record.id}>{body}</Link>
          )
        ) : (
          <article className="record-row" key={record.id}>{body}</article>
        );
      })}
    </div>
  );
}
