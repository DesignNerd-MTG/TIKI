import { normalizeManufacturerKey, type FixtureManufacturer } from "./fixture-manufacturers.ts";

export type GdtfMode = { name: string; footprint: number | null; warning: string };
export type GdtfReview = {
  version: string;
  name: string;
  manufacturer: string;
  description: string;
  weightLb: number | null;
  wattage?: number | null;
  modes: GdtfMode[];
  warnings: string[];
};
export type GdtfActionState = { review?: GdtfReview; error?: string };
export const gdtfUploadLimit = 4 * 1024 * 1024;
export function validateGdtfUpload(file: { name: string; size: number } | null | undefined) {
  if (!file || !file.size) return "Choose a non-empty .gdtf or .gdtf.zip file.";
  if (file.size > gdtfUploadLimit) return "Choose a GDTF file no larger than 4 MB.";
  if (!/\.gdtf(?:\.zip)?$/i.test(file.name)) return "Choose a .gdtf or .gdtf.zip file.";
  return "";
}

export function resolveGdtfManufacturer(value: string, manufacturers: FixtureManufacturer[]) {
  const key = normalizeManufacturerKey(value);
  if (!key || key === "chauvet") return null;
  const matches = manufacturers.filter((item) => item.active && [item.name, ...item.aliases].some((name) => normalizeManufacturerKey(name) === key));
  return matches.length === 1 ? matches[0] : null;
}

// Empty selection always means no imported preferred mode, never the first mode.
export function selectedGdtfMode(modes: GdtfMode[], selection: string) {
  if (!/^\d+$/.test(selection)) return null;
  return modes[Number(selection)] ?? null;
}

export function gdtfPrefill(review: GdtfReview, manufacturers: FixtureManufacturer[], selection: string) {
  const manufacturer = resolveGdtfManufacturer(review.manufacturer, manufacturers);
  const mode = selectedGdtfMode(review.modes, selection);
  return {
    name: review.name,
    manufacturer: manufacturer?.name ?? review.manufacturer,
    manufacturer_id: manufacturer?.id ?? "",
    field_notes: "",
    wattage: review.wattage ?? null,
    weight_lb: review.weightLb,
    ip_rating: "",
    preferred_mode: mode?.name ?? "",
    dmx_footprint: mode?.footprint ?? null,
  };
}
