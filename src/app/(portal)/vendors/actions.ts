"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActiveProfile } from "@/lib/auth";
import { isUuid } from "@/lib/content-validation";
import { createClient } from "@/lib/supabase/server";
import { normalizeVendorContacts, validVendorEmail, type VendorContact } from "@/lib/vendor-directory";

export type VendorActionState = { message: string; fieldErrors?: Record<string, string> };

export async function saveVendorAction(_state: VendorActionState, formData: FormData): Promise<VendorActionState> {
  await requireActiveProfile("editor");
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const kind = String(formData.get("kind") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();
  const status = String(formData.get("status") ?? "draft");
  const ids = formData.getAll("contact_id").map(String);
  const names = formData.getAll("contact_name").map(String);
  const titles = formData.getAll("contact_title").map(String);
  const emails = formData.getAll("contact_email").map(String);
  const cells = formData.getAll("contact_cell").map(String);
  const primaryIndex = Number(formData.get("primary_index") ?? -1);
  const contacts = normalizeVendorContacts(names.map((contactName, index) => ({
    ...(ids[index] ? { id: ids[index] } : {}), name: contactName, title: titles[index] || null,
    email: emails[index] || null, cell: cells[index] || null, is_primary: index === primaryIndex, sort_order: index,
  })) as VendorContact[]);
  const errors: Record<string, string> = {};
  if (!name || name.length > 160) errors.name = "Enter an organization name of 160 characters or fewer.";
  if (city.length > 120) errors.city = "Keep City to 120 characters or fewer.";
  if (!["vendor", "manufacturer", "client"].includes(kind)) errors.kind = "Choose a listed relationship.";
  if (!["draft", "submitted", "published", "archived"].includes(status)) errors.status = "Choose a valid status.";
  if (notes.length > 4000) errors.notes = "Keep notes to 4,000 characters or fewer.";
  contacts.forEach((contact, index) => {
    if (!contact.name || contact.name.length > 160) errors[`contact_${index}`] = "Every saved contact needs a name.";
    if ((contact.title?.length ?? 0) > 160) errors[`contact_${index}`] = "Keep contact titles to 160 characters or fewer.";
    if (!validVendorEmail(contact.email ?? "")) errors[`contact_${index}`] = "Enter a valid contact email.";
    if ((contact.cell?.length ?? 0) > 100) errors[`contact_${index}`] = "Keep contact phone text to 100 characters or fewer.";
  });
  if (id && !isUuid(id)) errors.id = "That organization could not be found.";
  if (Object.keys(errors).length) return { message: "Check the organization and contact details.", fieldErrors: errors };
  const client = await createClient();
  const result = await client.rpc("save_vendor_directory_entry", {
    target_id: id || null, organization_name: name, organization_city: city || null,
    relationship: kind, organization_notes: notes || null, publication_status: status, contacts,
  });
  if (result.error || !result.data) return { message: `The organization could not be saved. ${result.error?.message ?? "Try again."}` };
  revalidatePath("/vendors");
  revalidatePath(`/vendors/${result.data}`);
  redirect(`/vendors/${result.data}?saved=1`);
}
