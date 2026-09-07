import type { Metadata } from "next";
import { ContentDetailPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Link detail" };
export default async function LinkDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) { const [{ id }, query] = await Promise.all([params, searchParams]); return <ContentDetailPage kind="link" id={id} saved={query.saved} />; }
