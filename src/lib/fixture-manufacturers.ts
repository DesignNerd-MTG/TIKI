import { hasMinimumRole } from "./access.ts";
import type { AppRole } from "./types.ts";

export type FixtureManufacturer = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  aliases: string[];
};

export function normalizeManufacturerKey(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function slugifyManufacturer(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function manufacturerMatchesQuery(manufacturer: Pick<FixtureManufacturer, "name" | "aliases">, query: string) {
  const key = normalizeManufacturerKey(query);
  if (!key) return true;
  return [manufacturer.name, ...manufacturer.aliases].some((value) => normalizeManufacturerKey(value).includes(key));
}

export function findSimilarManufacturers(
  value: string,
  manufacturers: Array<Pick<FixtureManufacturer, "id" | "name" | "slug" | "active" | "aliases">>,
) {
  const key = normalizeManufacturerKey(value);
  if (!key) return [];
  return manufacturers.filter((manufacturer) => {
    const keys = [manufacturer.name, ...manufacturer.aliases].map(normalizeManufacturerKey).filter(Boolean);
    return keys.some((candidate) => candidate === key || (Math.min(candidate.length, key.length) >= 4 && (candidate.startsWith(key) || key.startsWith(candidate))));
  });
}

export function canAddFixtureManufacturer(role: AppRole | null | undefined) {
  return hasMinimumRole(role, "editor");
}

