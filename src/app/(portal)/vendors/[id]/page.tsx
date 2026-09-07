import type { Metadata } from "next";
import { ContentDetailPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Vendor or client detail" };
export default async function VendorDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) { const [{ id }, query] = await Promise.all([params, searchParams]); return <ContentDetailPage kind="vendor_client" id={id} saved={query.saved} />; }
