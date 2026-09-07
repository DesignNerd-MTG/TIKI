import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";
export const metadata: Metadata = { title: "New show" };
export default function NewShowPage() { return <ContentCreatePage kind="show" />; }
