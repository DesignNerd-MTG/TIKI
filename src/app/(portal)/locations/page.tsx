import type { Metadata } from "next";
import { MapPinned } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";

export const metadata: Metadata = { title: "Locations" };
export default function LocationsPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string; sort?: string }> }) {
  return <ContentIndexPage kind="location" searchParams={searchParams} icon={MapPinned} />;
}
