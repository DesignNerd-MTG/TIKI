// Server-only consumers: autocomplete route and Show save action. Never import in a client component.
import dataset from "../data/show-cities.json" with { type: "json" };
import type { ShowCity } from "./show-details.ts";

type CityRow = [string, string, string, string, string, string, number, number, number, string];
const rows = dataset as CityRow[];
const byId = new Map(rows.map((row) => [row[0], row]));
const aliases: Record<string, string> = { nyc: "5128581", vegas: "5506956" };
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function cityFromRow(row: CityRow): ShowCity {
  const [id, city, region, regionCode, country, country_code, latitude, longitude] = row;
  const display_name = country_code === "US" ? `${city}, ${regionCode}` : [city, region, country_code === "GB" ? "UK" : country].filter(Boolean).join(", ");
  return { source: "geonames", id, city, region, country, country_code, display_name, latitude, longitude };
}

const searchable = rows.map((row) => ({ row, words: normalize([row[1], row[9], row[2], row[3], row[4], row[5]].join(" ")).split(" "), name: normalize(row[1]) }));

export function getShowCity(id: string): ShowCity | null {
  const row = byId.get(id);
  return row ? cityFromRow(row) : null;
}

export function searchShowCities(query: string): ShowCity[] {
  const normalized = normalize(query.slice(0, 120));
  if (normalized.length < 2) return [];
  if (aliases[normalized]) return [getShowCity(aliases[normalized])!];
  const terms = normalized.split(" ");
  const startsWithCityWords = (name: string) => terms.every((term, index) => name.split(" ")[index]?.startsWith(term));
  // Independent word prefixes allow “san mo” to find Santa Monica.
  return searchable.filter(({ words }) => terms.every((term) => words.some((word) => word.startsWith(term))))
    .sort((a, b) => Number(b.name === normalized) - Number(a.name === normalized) || Number(b.name.startsWith(normalized)) - Number(a.name.startsWith(normalized)) || Number(startsWithCityWords(b.name)) - Number(startsWithCityWords(a.name)) || b.row[8] - a.row[8])
    .slice(0, 12).map(({ row }) => cityFromRow(row));
}

export function resolveShowLocation(id: string, mode: string, text: string, previous?: Record<string, unknown>) {
  if (id) {
    // Always resolve against trusted data, never accept client-supplied coordinates/names.
    const city = getShowCity(id);
    if (city) return { location: city.display_name, location_data: city };
    // Keep previously saved snapshots valid when a future dataset retires a city ID.
    const old = previous?.location_data as ShowCity | undefined;
    if (old?.id === id && previous?.location === text) return { location: text, location_data: old };
    return { error: "Choose a city from the suggestions again." };
  }
  if (previous && !previous.location_data && previous.location === text) return { location: text, location_data: null };
  if (!text.trim()) return { location: null, location_data: null };
  if (mode === "manual") return { location: text.trim(), location_data: null };
  return { error: "Select a suggested city, or use manual entry for an unlisted location." };
}
