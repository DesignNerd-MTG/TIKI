import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Vendors & Clients" };
export default function VendorsPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) { return <ContentIndexPage kind="vendor_client" searchParams={searchParams} icon={Building2} />; }
