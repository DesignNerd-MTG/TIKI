import type { Metadata } from "next";
import { Link2 } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Link Hub" };
export default function LinksPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) { return <ContentIndexPage kind="link" searchParams={searchParams} icon={Link2} />; }
