export type ProductionLocation = { id: string; name: string; city: string | null; region: string | null; country?: string | null };
export type ShowStop = { location_id: string; start_date: string; end_date: string };

export function readShowStops(value: unknown): ShowStop[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  return Array.isArray(value) ? value as ShowStop[] : [];
}

export function validateShowStops(raw: string): { stops: ShowStop[]; error?: string } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { stops: [], error: "Stops could not be read." }; }
  if (!Array.isArray(value) || value.length > 100) return { stops: [], error: "Use no more than 100 stops." };
  const stops: ShowStop[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || typeof entry.location_id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.location_id)) return { stops, error: "Choose a Location for every stop." };
    for (const key of ["start_date", "end_date"] as const) {
      if (typeof entry[key] !== "string" || (entry[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(entry[key]) || !Number.isFinite(Date.parse(entry[key])) || new Date(entry[key]).toISOString().slice(0, 10) !== entry[key]))) return { stops, error: "Use valid stop dates." };
    }
    if (entry.start_date && entry.end_date && entry.end_date < entry.start_date) return { stops, error: "A stop must end on or after its start date." };
    stops.push({ location_id: entry.location_id, start_date: entry.start_date, end_date: entry.end_date });
  }
  return { stops };
}

export function locationLabel(location: ProductionLocation) {
  return [location.name, location.city, location.region].filter(Boolean).join(" · ");
}

export function isGooglePhotosUrl(value: string) {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === "https:" && !url.username && !url.password && ["photos.google.com", "photos.app.goo.gl"].includes(url.hostname); } catch { return false; }
}
