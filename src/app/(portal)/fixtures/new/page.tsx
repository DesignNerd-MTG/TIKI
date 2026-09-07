import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";
export const metadata: Metadata = { title: "New fixture" };
export default function NewFixturePage() { return <ContentCreatePage kind="fixture" />; }
