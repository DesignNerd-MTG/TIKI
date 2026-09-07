import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";
export const metadata: Metadata = { title: "New link" };
export default function NewLinkPage() { return <ContentCreatePage kind="link" />; }
