import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";

export const metadata: Metadata = { title: "New drink" };
export default function NewDrinkPage() { return <ContentCreatePage kind="drink" />; }
