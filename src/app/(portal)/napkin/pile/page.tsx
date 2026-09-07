import type { Metadata } from "next";
import { Layers3 } from "lucide-react";
import { ContentIndexPage } from "@/components/content-pages";

export const metadata: Metadata = { title: "Pile of Napkins" };

export default function NapkinPilePage({ searchParams }: { searchParams: Promise<{ view?: string; deleted?: string }> }) {
  return (
    <ContentIndexPage
      kind="napkin"
      searchParams={searchParams}
      icon={Layers3}
      title="Pile of Napkins"
      eyebrow="Working knowledge"
      description="Peruse the department’s stored observations, useful fragments, and not-yet-filed knowledge."
      createLabel="Add a Napkin"
      createRoute="/napkin"
      listRoute="/napkin/pile"
    />
  );
}
