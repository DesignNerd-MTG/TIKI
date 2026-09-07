import type { Metadata } from "next";
import { Boxes } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "Fixtures" };
export default function FixturesPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) { return <ContentIndexPage kind="fixture" searchParams={searchParams} icon={Boxes} />; }
