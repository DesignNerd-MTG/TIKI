import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";
export const metadata: Metadata = { title: "New document" };
export default function NewDocumentPage() { return <ContentCreatePage kind="document" />; }
