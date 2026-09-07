import type { Metadata } from "next";
import { ClipboardPenLine } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";
export const metadata: Metadata = { title: "T.I.K.I. Napkin" };
export default function NapkinPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) { return <ContentIndexPage kind="napkin" searchParams={searchParams} icon={ClipboardPenLine} inlineCreate />; }
