import type { Metadata } from "next";
import { ContentDetailPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Napkin note" };
export default async function NapkinDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) { const [{ id }, query] = await Promise.all([params, searchParams]); return <ContentDetailPage kind="napkin" id={id} saved={query.saved} />; }
