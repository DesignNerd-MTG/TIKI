import type { Metadata } from "next";
import { BookOpenText } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Shows" };
export default function ShowsPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) { return <ContentIndexPage kind="show" searchParams={searchParams} icon={BookOpenText} />; }
