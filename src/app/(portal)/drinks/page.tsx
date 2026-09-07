import type { Metadata } from "next";
import { Martini } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";

export const metadata: Metadata = { title: "Drinks" };
export default function DrinksPage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) {
  return <ContentIndexPage kind="drink" searchParams={searchParams} icon={Martini} />;
}
