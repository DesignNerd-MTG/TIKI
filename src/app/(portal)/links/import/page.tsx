import { requireActiveProfile } from "@/lib/auth";
import { NotionImportForm } from "@/components/reference-controls";
import { PageHeader } from "@/components/ui";
export default async function ImportPage() {
  await requireActiveProfile("admin");
  return <div className="page-stack"><PageHeader eyebrow="One-time migration" title="Import Notion references" description="Validate your exported manifest first. Complete rows become drafts; incomplete rows are reported for review. Existing imports are skipped, preserving subsequent edits." /><section className="panel editor-panel"><NotionImportForm /></section></div>;
}
