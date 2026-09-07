import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";

export const metadata: Metadata = { title: "New location" };
export default function NewLocationPage() { return <ContentCreatePage kind="location" />; }
