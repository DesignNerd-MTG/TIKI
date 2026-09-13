import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { VendorEditor } from "@/components/vendor-editor";
import { PageHeader } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
export const metadata: Metadata = { title: "New vendor or manufacturer" };
export default async function NewVendorPage() {
  await requireActiveProfile("editor");
  return <div className="page-stack vendor-editor-page"><Link className="back-link" href="/vendors"><ArrowLeft size={16} /> Back to vendors / manufacturers</Link><PageHeader eyebrow="Restricted directory" title="Add vendor / manufacturer" description="Record the organization, its city, and only the contacts the team needs." /><section className="panel editor-panel"><VendorEditor /></section></div>;
}
