import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/content-validation";
export default async function RetiredDocument({params}:{params:Promise<{id:string}>}) {
  await requireActiveProfile();
  const {id}=await params;
  if(!isUuid(id)) redirect("/links?collection=ldg-ldge-documents");
  const client=await createClient();
  const {data}=await client.from("link_items").select("id").eq("import_source","document:"+id).maybeSingle();
  if(data) redirect("/links/"+data.id);
  return <section className="panel detail-panel"><h1>Documents has moved</h1><p>This legacy item is unavailable or still awaiting consolidation. Its original data has not been deleted. Ask an administrator to review it.</p><Link href="/links?collection=ldg-ldge-documents">Open LDG / LDGE Documents</Link></section>;
}
