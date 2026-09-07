import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, DatabaseZap, SearchX } from "lucide-react";

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
    meta: string;
    detail?: string | null;
    status?: string;
    href?: string | null;
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
                <h2>{record.title}</h2>
                {record.external && <ArrowUpRight size={15} aria-hidden="true" />}
              </div>
              <p>{record.meta}</p>
              {record.detail && <span className="record-row__detail">{record.detail}</span>}
            </div>
            <div className="record-row__aside">
              {record.status && <StatusPill status={record.status} />}
              {record.date && <time dateTime={record.date}>{formatDate(record.date)}</time>}
            </div>
          </>
        );

        return record.href ? (
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
