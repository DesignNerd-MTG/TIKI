"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BookOpenText,
  Boxes,
  Building2,
  ChevronRight,
  ClipboardPenLine,
  FileText,
  Gauge,
  Layers3,
  Link2,
  ListChecks,
  MapPinned,
  Menu,
  Martini,
  PlaneTakeoff,
  Search,
  Settings2,
  X,
} from "lucide-react";

import { hasMinimumRole, roleLabel } from "@/lib/access";
import { initials } from "@/lib/format";
import type { AppRole } from "@/lib/types";
import { Brand } from "@/components/brand";
import { InstallTiki } from "@/components/install-tiki";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, minimum: "viewer" },
  { href: "/fixtures", label: "Fixtures", icon: Boxes, minimum: "viewer" },
  { href: "/shows", label: "Shows", icon: BookOpenText, minimum: "viewer" },
  { href: "/links", label: "Link Hub", icon: Link2, minimum: "viewer" },
  { href: "/documents", label: "Documents", icon: FileText, minimum: "viewer" },
  { href: "/napkin", label: "Add a Napkin", icon: ClipboardPenLine, minimum: "viewer" },
  { href: "/napkin/pile", label: "Pile of Napkins", icon: Layers3, minimum: "viewer" },
  { href: "/napkin/queue", label: "Napkin Queue", icon: ListChecks, minimum: "editor" },
  { href: "/locations", label: "Locations", icon: MapPinned, minimum: "viewer" },
  { href: "/drinks", label: "Drinks", icon: Martini, minimum: "viewer" },
  { href: "/travel", label: "Travel Portal", icon: PlaneTakeoff, minimum: "viewer" },
  { href: "/vendors", label: "Vendors / Clients", icon: Building2, minimum: "editor" },
  { href: "/admin", label: "Admin", icon: Settings2, minimum: "admin" },
] as const;

type AppShellProps = {
  children: React.ReactNode;
  name: string;
  email: string;
  role: AppRole;
};

export function AppShell({ children, name, email, role }: AppShellProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const visibleNavigation = navigation.filter((item) => hasMinimumRole(role, item.minimum));
  const isActive = (href: string) => {
    if (href === "/napkin") return pathname === href;
    if (href === "/napkin/pile") return pathname === href || (/^\/napkin\/[^/]+$/.test(pathname) && !pathname.endsWith("/queue"));
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  const nav = (
    <>
      <div className="sidebar__brand">
        <Brand href="/dashboard" inverse />
      </div>
      <nav className="sidebar__nav" aria-label="Portal navigation">
        <p className="sidebar__eyebrow">Knowledge base</p>
        {visibleNavigation.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              href={item.href}
              key={item.href}
              className={`nav-link ${active ? "nav-link--active" : ""}`}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} strokeWidth={1.8} aria-hidden="true" />
              <span>{item.label}</span>
              {active && <ChevronRight className="nav-link__arrow" size={15} aria-hidden="true" />}
            </Link>
          );
        })}
      </nav>
      <div className="sidebar__footer">
        <InstallTiki />
        <div className="user-card">
          <div className="avatar" aria-hidden="true">{initials(name || email)}</div>
          <div className="user-card__copy">
            <strong>{name || email.split("@")[0]}</strong>
            <span>{roleLabel(role)}</span>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="sign-out" type="submit">Sign out</button>
        </form>
      </div>
    </>
  );

  return (
    <div className="app-frame">
      <aside className="sidebar">{nav}</aside>

      <div className={`mobile-drawer ${open ? "mobile-drawer--open" : ""}`}>
        <button className="mobile-drawer__scrim" aria-label="Close menu" onClick={() => setOpen(false)} />
        <aside className="mobile-drawer__panel">
          <button className="icon-button mobile-drawer__close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
          {nav}
        </aside>
      </div>

      <div className="workspace">
        <header className="topbar">
          <button className="icon-button menu-button" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={21} />
          </button>
          <form className="global-search" action="/search" method="get" role="search">
            <Search size={18} aria-hidden="true" />
            <input name="q" type="search" maxLength={100} placeholder="Search content, notes, and tags…" aria-label="Search T.I.K.I." />
            <kbd>Enter</kbd>
          </form>
          <div className="topbar__identity">
            <span className="status-dot" aria-hidden="true" />
            <span>LDG private portal</span>
          </div>
        </header>
        <main className="workspace__main">{children}</main>
      </div>
    </div>
  );
}
