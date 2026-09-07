import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { DashboardView, type DashboardSnapshot } from "@/components/dashboard-view";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardSnapshot(canSeeRestricted: boolean): Promise<{ snapshot: DashboardSnapshot; databaseReady: boolean }> {
  const supabase = await createClient();
  const vendorCount = canSeeRestricted ? supabase.from("vendor_clients").select("id", { count: "exact", head: true }).neq("status", "archived") : Promise.resolve({ count: 0, error: null });
  const recentVendors = canSeeRestricted ? supabase.from("vendor_clients").select("id,name,kind,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(3) : Promise.resolve({ data: [] });
  const [fixtures, shows, links, documents, locations, drinks, napkin, vendors, recentFixtures, recentShows, recentLinks, recentDocuments, recentLocations, recentDrinks, recentNapkin, vendorRecent] = await Promise.all([
    supabase.from("fixtures").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("shows").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("link_items").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("documents").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("locations").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("drinks").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("napkin_notes").select("id", { count: "exact", head: true }).neq("status", "archived"),
    vendorCount,
    supabase.from("fixtures").select("id,name,manufacturer,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(3),
    supabase.from("shows").select("id,title,job_number,location,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(2),
    supabase.from("link_items").select("id,label,category,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(2),
    supabase.from("documents").select("id,title,document_type,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(2),
    supabase.from("locations").select("id,name,kind,city,region,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(2),
    supabase.from("drinks").select("id,name,glassware,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(2),
    supabase.from("napkin_notes").select("id,body,updated_at").neq("status", "archived").order("updated_at", { ascending: false }).limit(2),
    recentVendors,
  ]);

  const databaseReady = !fixtures.error && !locations.error && !drinks.error;
  const recent = [
    ...(recentFixtures.data ?? []).map((item) => ({
      id: item.id,
      title: item.name,
      category: "Fixture",
      meta: `${item.manufacturer || "Manufacturer pending"} · updated recently`,
      href: `/fixtures/${item.id}`,
      updatedAt: item.updated_at,
    })),
    ...(recentShows.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      category: "Show",
      meta: `${[item.job_number ? `Job ${item.job_number}` : null, item.location || "Location pending"].filter(Boolean).join(" · ")} · updated recently`,
      href: `/shows/${item.id}`,
      updatedAt: item.updated_at,
    })),
    ...(recentLinks.data ?? []).map((item) => ({ id: item.id, title: item.label, category: "Link", meta: item.category, href: `/links/${item.id}`, updatedAt: item.updated_at })),
    ...(recentDocuments.data ?? []).map((item) => ({ id: item.id, title: item.title, category: "Document", meta: item.document_type || "Reference document", href: `/documents/${item.id}`, updatedAt: item.updated_at })),
    ...(recentLocations.data ?? []).map((item) => ({ id: item.id, title: item.name, category: "Location", meta: [item.kind, item.city, item.region].filter(Boolean).join(" · ") || "Useful place", href: `/locations/${item.id}`, updatedAt: item.updated_at })),
    ...(recentDrinks.data ?? []).map((item) => ({ id: item.id, title: item.name, category: "Drink", meta: item.glassware || "Cocktail recipe", href: `/drinks/${item.id}`, updatedAt: item.updated_at })),
    ...(recentNapkin.data ?? []).map((item) => ({ id: item.id, title: item.body.length > 70 ? `${item.body.slice(0, 70)}…` : item.body, category: "Napkin", meta: "Working knowledge", href: `/napkin/${item.id}`, updatedAt: item.updated_at })),
    ...(vendorRecent.data ?? []).map((item) => ({ id: item.id, title: item.name, category: "Vendor", meta: item.kind, href: `/vendors/${item.id}`, updatedAt: item.updated_at })),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 7);

  return {
    databaseReady,
    snapshot: {
      counts: {
        fixtures: fixtures.count ?? 0,
        shows: shows.count ?? 0,
        links: links.count ?? 0,
        documents: documents.count ?? 0,
        locations: locations.count ?? 0,
        drinks: drinks.count ?? 0,
        napkin: napkin.count ?? 0,
        vendors: vendors.count ?? 0,
      },
      recent,
    },
  };
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const [{ profile }, params] = await Promise.all([requireActiveProfile(), searchParams]);
  const { snapshot, databaseReady } = await getDashboardSnapshot(profile.role === "editor" || profile.role === "admin");

  return (
    <>
      {params.notice === "restricted" && (
        <div className="notice notice--warning page-notice">
          <AlertTriangle size={18} />
          <div><strong>That section is restricted.</strong><span>Your current role does not include access.</span></div>
        </div>
      )}
      {!databaseReady && (
        <div className="notice notice--warning page-notice">
          <AlertTriangle size={18} />
          <div><strong>The portal is connected, but its tables are not ready.</strong><span>Run the initial Supabase migration from the setup guide.</span></div>
        </div>
      )}
      <DashboardView snapshot={snapshot} />
    </>
  );
}
