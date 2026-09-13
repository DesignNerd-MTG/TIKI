export const vendorSorts = ["name-asc", "name-desc", "city-asc", "city-desc"] as const;
export type VendorSort = (typeof vendorSorts)[number];
export function vendorSort(value: string | undefined): VendorSort {
  return vendorSorts.includes(value as VendorSort) ? value as VendorSort : "name-asc";
}

export type VendorContact = {
  id?: string;
  name: string;
  title: string | null;
  email: string | null;
  cell: string | null;
  is_primary: boolean;
  sort_order: number;
};

export type VendorDirectoryRecord = {
  id: string;
  name: string;
  city: string | null;
  kind: "vendor" | "manufacturer" | "client";
  notes: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  contacts: VendorContact[];
  total_count?: number;
};

export function validVendorEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeVendorContacts(items: VendorContact[]) {
  return items.map((item, index) => ({
    ...(item.id ? { id: item.id } : {}),
    name: item.name.trim(), title: item.title?.trim() || null, email: item.email?.trim() || null,
    cell: item.cell?.trim() || null, is_primary: Boolean(item.is_primary), sort_order: index,
  }));
}
