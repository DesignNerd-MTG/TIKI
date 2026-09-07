import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";

import { DashboardView } from "@/components/dashboard-view";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Portal preview" };

const previewSnapshot = {
  counts: { fixtures: 12, shows: 4, links: 18, documents: 27, napkin: 6 },
  recent: [
    { id: "1", title: "ColorForce II 72", category: "Fixture", meta: "Preferred mode reviewed", href: "/login", updatedAt: "2026-09-07T00:00:00Z" },
    { id: "2", title: "Broadcast package reference", category: "Show", meta: "Dropbox link updated", href: "/login", updatedAt: "2026-09-06T00:00:00Z" },
    { id: "3", title: "Proteus Maximus field note", category: "Fixture", meta: "Control note verified", href: "/login", updatedAt: "2026-09-05T00:00:00Z" },
  ],
};

export default function PreviewPage() {
  return (
    <div className="preview-page">
      <header className="preview-bar">
        <Brand href="/login" compact inverse />
        <div className="preview-bar__mode"><Eye size={15} /> Interface preview</div>
        <Link href="/login"><ArrowLeft size={15} /> Back to setup</Link>
      </header>
      <main className="preview-content">
        <div className="notice notice--preview">
          <Eye size={18} />
          <div><strong>You’re viewing sample content.</strong><span>Connect Supabase and sign in to use the real private portal.</span></div>
        </div>
        <DashboardView snapshot={previewSnapshot} preview />
      </main>
    </div>
  );
}
