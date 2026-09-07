import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Documents" };
export default function DocumentsPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) { return <ContentIndexPage kind="document" searchParams={searchParams} icon={FileText} />; }
