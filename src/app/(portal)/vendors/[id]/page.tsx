import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { VendorEditor } from "@/components/vendor-editor";
import { PageHeader, StatusPill } from "@/components/ui";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { VendorContact, VendorDirectoryRecord } from "@/lib/vendor-directory";
import { ShareRecord } from "@/components/share-record";
export const metadata: Metadata = { title: "Vendor / manufacturer detail" };
export default async function VendorDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  await requireActiveProfile("editor"); const [{ id }, query] = await Promise.all([params, searchParams]); const client = await createClient();
  const [vendorResult, contactsResult] = await Promise.all([client.from("vendor_clients").select("*").eq("id", id).maybeSingle(), client.from("vendor_contacts").select("id,name,title,email,cell,is_primary,sort_order").eq("vendor_id", id).order("is_primary", { ascending: false }).order("sort_order")]);
  if (!vendorResult.data) notFound(); const record = { ...vendorResult.data, contacts: (contactsResult.data ?? []) as VendorContact[] } as VendorDirectoryRecord; const primary = record.contacts.find((contact) => contact.is_primary); const others = record.contacts.filter((contact) => !contact.is_primary);
  return <div className="page-stack vendor-editor-page"><Link className="back-link" href="/vendors"><ArrowLeft size={16} /> Back to vendors / manufacturers</Link>{query.saved && <div className="notice notice--success">Organization saved.</div>}
    <PageHeader eyebrow={[record.city, record.kind].filter(Boolean).join(" · ")} title={record.name} description={record.notes || "Restricted business and contact reference."} action={<div className="detail-hero__actions"><StatusPill status={record.status} /><ShareRecord title={record.name} /></div>} />
    <section className="panel vendor-contact-summary"><div><p className="eyebrow">Primary Contact</p>{primary ? <Contact contact={primary} /> : <p className="compact-empty">No primary contact selected.</p>}</div>{others.length > 0 && <div><p className="eyebrow">Additional Contacts</p><div className="vendor-contact-summary__additional">{others.map((contact) => <Contact contact={contact} key={contact.id} />)}</div></div>}</section>
    <section className="panel editor-panel"><div className="panel__heading"><div><p className="eyebrow">Editor access</p><h2>Edit organization</h2></div></div><VendorEditor record={record} /></section>
  </div>;
}
function Contact({ contact }: { contact: VendorContact }) { return <article className="vendor-contact"><strong>{contact.name}</strong>{contact.title && <span>{contact.title}</span>}<div>{contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}{contact.cell && <a href={`tel:${contact.cell}`}>{contact.cell}</a>}</div></article>; }
