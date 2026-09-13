"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveVendorAction } from "@/app/(portal)/vendors/actions";
import type { VendorContact, VendorDirectoryRecord } from "@/lib/vendor-directory";

type EditableContact = VendorContact & { key: string };
const editable = (contact?: VendorContact, index=0): EditableContact => ({
  id: contact?.id, name: contact?.name ?? "", title: contact?.title ?? "", email: contact?.email ?? "",
  cell: contact?.cell ?? "", is_primary: contact?.is_primary ?? false, sort_order: index,
  key: contact?.id ?? `new-${Date.now()}-${index}-${Math.random()}`,
});

export function VendorEditor({ record }: { record?: VendorDirectoryRecord }) {
  const [state, action, pending] = useActionState(saveVendorAction, { message: "" });
  const [contacts, setContacts] = useState<EditableContact[]>(() => (record?.contacts ?? []).map(editable));
  const primaryIndex = contacts.findIndex((contact) => contact.is_primary);
  const update = (index: number, patch: Partial<EditableContact>) => setContacts((current) => current.map((contact, position) => position === index ? { ...contact, ...patch } : contact));
  const makePrimary = (index: number) => setContacts((current) => current.map((contact, position) => ({ ...contact, is_primary: position === index })));
  return <form action={action} className="vendor-form">
    {record && <input type="hidden" name="id" value={record.id} />}
    <div className="vendor-form__organization">
      <label className="form-field"><span>Organization Name</span><input name="name" required maxLength={160} defaultValue={record?.name ?? ""} aria-invalid={Boolean(state.fieldErrors?.name)} /></label>
      <label className="form-field"><span>City</span><input name="city" maxLength={120} defaultValue={record?.city ?? ""} placeholder="New York" aria-invalid={Boolean(state.fieldErrors?.city)} /></label>
      <label className="form-field"><span>Relationship</span><select name="kind" defaultValue={record?.kind ?? "vendor"}><option value="vendor">Vendor</option><option value="manufacturer">Manufacturer</option><option value="client">Client</option></select></label>
      <label className="form-field"><span>Status</span><select name="status" defaultValue={record?.status ?? "draft"}><option value="draft">Draft</option><option value="submitted">Awaiting approval</option><option value="published">Published</option><option value="archived">Archived</option></select></label>
      <label className="form-field vendor-form__notes"><span>Operational notes</span><textarea name="notes" maxLength={4000} rows={4} defaultValue={record?.notes ?? ""} /></label>
    </div>
    <section className="vendor-contacts-editor">
      <div className="panel__heading"><div><p className="eyebrow">People</p><h2>Contacts</h2></div><button className="secondary-button" type="button" onClick={() => setContacts((current) => [...current, editable(undefined, current.length)])}><Plus size={16} /> Add Contact</button></div>
      {!contacts.length && <p className="compact-empty">No contacts. Organizations can be saved without one.</p>}
      {contacts.length > 0 && primaryIndex < 0 && <p className="notice notice--neutral vendor-primary-notice">No primary contact selected.</p>}
      {contacts.map((contact, index) => <fieldset className="vendor-contact-row" key={contact.key}>
        <legend>Contact</legend>
        <input type="hidden" name="contact_id" value={contact.id ?? ""} />
        <label className="form-field"><span>Name</span><input name="contact_name" required maxLength={160} value={contact.name} onChange={(event) => update(index,{name:event.target.value})} aria-invalid={Boolean(state.fieldErrors?.[`contact_${index}`])} /></label>
        <label className="form-field"><span>Title</span><input name="contact_title" maxLength={160} value={contact.title ?? ""} onChange={(event) => update(index,{title:event.target.value})} /></label>
        <label className="form-field"><span>Email</span><input name="contact_email" type="email" maxLength={254} value={contact.email ?? ""} onChange={(event) => update(index,{email:event.target.value})} /></label>
        <label className="form-field"><span>Cell</span><input name="contact_cell" type="tel" maxLength={100} value={contact.cell ?? ""} onChange={(event) => update(index,{cell:event.target.value})} /></label>
        <div className="vendor-contact-row__actions">{contact.is_primary ? <span className="primary-contact-badge">Primary</span> : <button className="secondary-button vendor-make-primary" type="button" onClick={() => makePrimary(index)}>Make Primary</button>}<button className="icon-button" type="button" aria-label={`Remove ${contact.name || "contact"}`} onClick={() => setContacts((current) => current.filter((_, position) => position !== index))}><Trash2 size={16} /></button></div>
      </fieldset>)}
      <input type="hidden" name="primary_index" value={primaryIndex} />
      {primaryIndex >= 0 && <button className="text-button" type="button" onClick={() => setContacts((current) => current.map((contact) => ({...contact,is_primary:false})))}>Clear Primary Contact</button>}
    </section>
    {state.message && <div className="notice notice--error" role="status">{state.message}</div>}
    <div className="content-form__actions content-form__actions--sticky vendor-form__actions"><button className="primary-button vendor-form__save" type="submit" disabled={pending}>{pending ? "Saving…" : record ? "Save organization" : "Add organization"}</button></div>
  </form>;
}
