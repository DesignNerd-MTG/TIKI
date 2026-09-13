import type { Metadata } from "next";
import { ContentCreatePage } from "@/components/content-pages";
import { referenceCollection, validCollectionPair } from "@/lib/references";
export const metadata: Metadata = { title: "New link" };
export default async function NewLinkPage({ searchParams }: { searchParams: Promise<{ collection?: string; subcollection?: string }> }) {
  const params = await searchParams;
  const collection = referenceCollection(params.collection);
  const subcollection = referenceCollection(params.subcollection);
  const pair = collection && !collection.parent_id && validCollectionPair(collection.id, subcollection?.id ?? "")
    ? { collection_id: collection.id, subcollection_id: subcollection?.id ?? "" }
    : undefined;
  return <ContentCreatePage kind="link" initialValues={pair} />;
}
