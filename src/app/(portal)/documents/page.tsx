import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
export default async function RetiredDocuments() {
  await requireActiveProfile();
  redirect("/links?collection=ldg-ldge-documents");
}
