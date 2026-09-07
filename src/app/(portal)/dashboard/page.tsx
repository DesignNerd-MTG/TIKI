import type { Metadata } from "next";
import { AlertTriangle } from "lucide-react";

import { DashboardView, type DashboardSnapshot } from "@/components/dashboard-view";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

async function getDashboardSnapshot(): Promise<{ snapshot: DashboardSnapshot; databaseReady: boolean }> {
  const supabase = await createClient();
  const [fixtures, shows, links, documents, napkin, recentFixtures, recentShows] = await Promise.all([
    supabase.from("fixtures").select("id", { count: "exact", head: true }),
    supabase.from("shows").select("id", { count: "exact", head: true }),
    supabase.from("link_items").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase.from("napkin_notes").select("id", { count: "exact", head: true }).neq("status", "archived"),
    supabase.from("fixtures").select("id,name,manufacturer,updated_at").order("updated_at", { ascending: false }).limit(3),
    supabase.from("shows").select("id,title,location,updated_at").order("updated_at", { ascending: false }).limit(2),
  ]);

  const databaseReady = !fixtures.error;
  const recent = [
    ...(recentFixtures.data ?? []).map((item) => ({
      id: item.id,
      title: item.name,
      category: "Fixture",
      meta: `${item.manufacturer || "Manufacturer pending"} · updated recently`,
    })),
    ...(recentShows.data ?? []).map((item) => ({
      id: item.id,
      title: item.title,
      category: "Show",
      meta: `${item.location || "Location pending"} · updated recently`,
    })),
  ].slice(0, 5);

  return {
    databaseReady,
    snapshot: {
      counts: {
        fixtures: fixtures.count ?? 0,
        shows: shows.count ?? 0,
        links: links.count ?? 0,
        documents: documents.count ?? 0,
        napkin: napkin.count ?? 0,
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
  const [{ snapshot, databaseReady }, params] = await Promise.all([
    getDashboardSnapshot(),
    searchParams,
  ]);

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
