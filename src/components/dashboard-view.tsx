import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  BookOpenText,
  ClipboardPenLine,
  FileText,
  Link2,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { hasMinimumRole } from "@/lib/access";
import type { AppRole } from "@/lib/types";

const modules = [
  { href: "/fixtures", label: "Fixtures", description: "Modes, charts & field notes", icon: Boxes, key: "fixtures" },
  { href: "/shows", label: "Shows", description: "Files, folders & references", icon: BookOpenText, key: "shows" },
  { href: "/links", label: "Link Hub", description: "The portals you use every day", icon: Link2, key: "links" },
  { href: "/documents", label: "Documents", description: "Manuals, plots & paperwork", icon: FileText, key: "documents" },
] as const;

export type DashboardSnapshot = {
  counts: Record<string, number>;
  recent: Array<{
    id: string;
    title: string;
    category: string;
    meta: string;
    href: string;
    updatedAt: string;
  }>;
};

export function DashboardView({ snapshot, preview = false, role = "viewer" }: { snapshot: DashboardSnapshot; preview?: boolean; role?: AppRole }) {
  const linkFor = (href: string) => (preview ? "/login" : href);

  return (
    <div className="dashboard-stack">
      <section className="dashboard-hero">
        <div className="dashboard-hero__glow" aria-hidden="true" />
        <div className="dashboard-hero__copy">
          <span className="hero-kicker"><Sparkles size={14} /> Technical knowledge, minus the scavenger hunt.</span>
          <h1>What do you need to find?</h1>
          <p>Search the department’s fixtures, show references, documents, links, and verified field knowledge.</p>
          <form className="hero-search" action={preview ? "/login" : "/search"} method="get">
            <Search size={21} aria-hidden="true" />
            <input name="q" placeholder="Try “Proteus mode” or “expense report”…" aria-label="Search T.I.K.I." />
            <button type="submit">Search</button>
          </form>
        </div>
      </section>

      {!preview && (
        <section className="dashboard-actions" aria-label="Quick actions">
          <div><p className="eyebrow">Quick actions</p><h2>Keep the index moving</h2></div>
          <div className="page-actions">
            <Link className="secondary-button" href="/napkin"><Plus size={15} /> Capture a Napkin</Link>
            {hasMinimumRole(role, "contributor") && <Link className="primary-button" href="/fixtures/new"><Plus size={15} /> Add knowledge</Link>}
          </div>
        </section>
      )}

      <section>
        <div className="section-heading">
          <div>
            <p className="eyebrow">Published knowledge</p>
            <h2>Start somewhere useful</h2>
          </div>
        </div>
        <div className="module-grid">
          {modules.map((module, index) => {
            const Icon = module.icon;
            return (
              <Link className={`module-card module-card--${index + 1}`} href={linkFor(module.href)} key={module.href}>
                <span className="module-card__icon"><Icon size={22} /></span>
                <div>
                  <span className="module-card__count">{snapshot.counts[module.key] ?? 0}</span>
                  <h3>{module.label}</h3>
                  <p>{module.description}</p>
                </div>
                <ArrowRight className="module-card__arrow" size={18} />
              </Link>
            );
          })}
        </div>
      </section>

      <div className="dashboard-columns">
        <section className="panel recent-panel">
          <div className="panel__heading">
            <div>
              <p className="eyebrow">Fresh in T.I.K.I.</p>
              <h2>Recently updated</h2>
            </div>
            {!preview && <Link href="/search">Browse all <ArrowRight size={15} /></Link>}
          </div>
          <div className="recent-list">
            {snapshot.recent.length ? snapshot.recent.map((item) => (
              <Link className="recent-item" href={item.href} key={`${item.category}-${item.id}`}>
                <span className="recent-item__badge">{item.category.slice(0, 1)}</span>
                <div><strong>{item.title}</strong><span>{item.meta}</span></div>
              </Link>
            )) : (
              <div className="compact-empty">Published updates will collect here as the team builds the index.</div>
            )}
          </div>
        </section>

        <section className="panel napkin-card">
          <span className="napkin-card__icon"><ClipboardPenLine size={22} /></span>
          <p className="eyebrow">Working knowledge</p>
          <h2>Throw it on the Napkin.</h2>
          <p>Save the useful thought now. Sort it, verify it, and publish it later.</p>
          <Link className="text-link" href={linkFor("/napkin")}>Open T.I.K.I. Napkin <ArrowRight size={15} /></Link>
          <span className="napkin-card__count">{snapshot.counts.napkin ?? 0} open notes</span>
        </section>
      </div>
    </div>
  );
}
