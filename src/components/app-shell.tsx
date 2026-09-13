"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  Boxes,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardPenLine,
  Gauge,
  Layers3,
  Link2,
  ListChecks,
  MapPinned,
  Menu,
  Martini,
  PlaneTakeoff,
  Pin,
  Search,
  Settings2,
  Users,
  UserRound,
  X,
} from "lucide-react";

import { hasMinimumRole, roleLabel } from "@/lib/access";
import { MemberAvatar } from "@/components/member-avatar";
import type { AppRole } from "@/lib/types";
import { Brand } from "@/components/brand";
import { InstallTiki } from "@/components/install-tiki";
import { version } from "../../package.json";

export const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge, minimum: "viewer" },
  { href: "/shows", label: "Shows", icon: BookOpenText, minimum: "viewer" },
  { href: "/fixtures", label: "Fixtures", icon: Boxes, minimum: "viewer" },
  { href: "/locations", label: "Locations", icon: MapPinned, minimum: "viewer" },
  { href: "/vendors", label: "Vendors / Manufacturers", icon: Building2, minimum: "editor" },
  { href: "/links", label: "Reference Hub", icon: Link2, minimum: "viewer" },
  { href: "/links/social", label: "Social Directory", icon: Users, minimum: "viewer" },
  { href: "/napkin", label: "Napkins", icon: ClipboardPenLine, minimum: "viewer", group: true },
  { href: "/drinks", label: "Drinks", icon: Martini, minimum: "viewer" },
  { href: "/account", label: "My Account", icon: UserRound, minimum: "viewer" },
  { href: "/travel", label: "Travel Prefs", icon: PlaneTakeoff, minimum: "viewer" },
  { href: "/admin", label: "Admin", icon: Settings2, minimum: "admin" },
] as const;

export const napkinNavigation = [
  { href: "/napkin", label: "Add a Napkin", icon: ClipboardPenLine, minimum: "viewer" },
  { href: "/napkin/pile", label: "Stack O' Napkins", icon: Layers3, minimum: "viewer" },
  { href: "/napkin/queue", label: "Napkins to Review", icon: ListChecks, minimum: "editor" },
  { href: "/napkin/pinned", label: "Pinned Napkins", icon: Pin, minimum: "viewer" },
] as const;

type AppShellProps = {
  children: React.ReactNode;
  name: string;
  email: string;
  role: AppRole;
  profileId?: string;
  avatarVersion?: string;
};

export function AppShell({ children, name, email, role, profileId, avatarVersion }: AppShellProps) {
  const pathname = usePathname();
  const searchRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const onNapkinRoute = pathname === "/napkin" || pathname.startsWith("/napkin/");
  const [napkinsOpen, setNapkinsOpen] = useState(onNapkinRoute);
  const [closedNapkinPath, setClosedNapkinPath] = useState<string | null>(null);
  const napkinsExpanded = onNapkinRoute ? closedNapkinPath !== pathname : napkinsOpen;
  const visibleNavigation = navigation.filter((item) => hasMinimumRole(role, item.minimum));
  const visibleNapkins = napkinNavigation.filter((item) => hasMinimumRole(role, item.minimum));
  const isActive = (href: string) => {
    if (href === "/links" && pathname === "/links/social") return false;
    if (href === "/napkin") return pathname === href;
    if (href === "/napkin/pile") return pathname === href || /^\/napkin\/[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(pathname);
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches("input, textarea, select") || target.isContentEditable || Boolean(target.closest("[contenteditable='true']")))) return;
      const slash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;
      const command = event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey) && !event.altKey;
      if (!slash && !command) return;
      const input = searchRef.current;
      if (!input || input.getClientRects().length === 0) return;
      event.preventDefault();
      input.focus();
      input.select();
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  const nav = (
    <>
      <div className="sidebar__brand">
        <Brand href="/dashboard" inverse />
      </div>
      <nav className="sidebar__nav" aria-label="Portal navigation">
        {visibleNavigation.map((item) => {
          if ("group" in item && item.group) {
            const Icon = item.icon;
            return <div className="nav-group" key={item.href}>
              <button type="button" className={`nav-link nav-group__toggle ${onNapkinRoute ? "nav-link--active" : ""}`} aria-expanded={napkinsExpanded} aria-controls="napkin-navigation" onClick={() => { if (onNapkinRoute) setClosedNapkinPath(napkinsExpanded ? pathname : null); else setNapkinsOpen((value) => !value); }}>
                <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>
                <ChevronDown className={`nav-group__chevron ${napkinsExpanded ? "is-open" : ""}`} size={15} aria-hidden="true" />
              </button>
              {napkinsExpanded && <div className="nav-group__children" id="napkin-navigation">
                {visibleNapkins.map((child) => { const ChildIcon=child.icon; const active=isActive(child.href); return <Link href={child.href} key={child.href} className={`nav-link nav-link--child ${active ? "nav-link--active" : ""}`} onClick={() => setOpen(false)}><ChildIcon size={15} strokeWidth={1.8} aria-hidden="true" /><span>{child.label}</span>{active && <ChevronRight className="nav-link__arrow" size={13} aria-hidden="true" />}</Link>; })}
              </div>}
            </div>;
          }
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
        <small className="sidebar__version">T.I.K.I. v{version}</small>
        <Link href="/account" className="user-card user-card--editable" aria-label="Open My Account" onClick={() => setOpen(false)}>
          <MemberAvatar id={profileId} name={name || email} version={avatarVersion} />
          <div className="user-card__copy">
            <strong>{name || email.split("@")[0]}</strong>
            <span>{roleLabel(role)}</span>
          </div>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
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
            <input ref={searchRef} name="q" type="search" maxLength={100} placeholder="Search content, notes, and tags…" aria-label="Search T.I.K.I." />
            <kbd>/ · ⌘/Ctrl K</kbd>
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
