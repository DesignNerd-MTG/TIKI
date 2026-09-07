import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";
export const metadata: Metadata = { title: "New vendor or client" };
export default function NewVendorPage() { return <ContentCreatePage kind="vendor_client" />; }
