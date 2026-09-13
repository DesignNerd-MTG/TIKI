import type { Metadata } from "next";
import { ReferenceHub, type ReferenceParams } from "@/components/reference-hub";
export const metadata: Metadata = { title: "Reference Hub" };
export default async function LinksPage({ searchParams }: { searchParams: Promise<ReferenceParams> }) {
  return <ReferenceHub params={await searchParams} />;
}
