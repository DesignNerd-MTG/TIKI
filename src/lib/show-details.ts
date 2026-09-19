export type ShowPerson = {
  id: string;
  role: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
  primary: boolean;
  position: number;
};

export type ShowCity = {
  source: "geonames";
  id: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  display_name: string;
  latitude: number;
  longitude: number;
};

export const showRolePresets = [
  "Lighting Designer / LD", "Gaffer", "Assistant Lighting Designer / ALD", "Programmer",
  "Production Designer", "Executive Producer / EP", "Producer", "Line Producer",
  "Production Manager", "Technical Manager", "Director", "Director of Photography / DP",
];

export function readShowPeople(value: unknown): ShowPerson[] {
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return []; }
  }
  return Array.isArray(value) ? value.filter((entry) => entry && typeof entry === "object" && ["id", "role", "name", "company", "email", "phone", "notes"].every((key) => typeof entry[key] === "string") && typeof entry.primary === "boolean") as ShowPerson[] : [];
}

export function orderShowPeople(people: ShowPerson[]) {
  return [...people].sort((a, b) => Number(b.primary) - Number(a.primary) || a.position - b.position);
}

export function moveShowPerson(people: ShowPerson[], index: number, direction: -1 | 1) {
  const next = [...people];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next.map((person, position) => ({ ...person, position }));
}

export function validateShowPeople(raw: string): { people: ShowPerson[]; error?: string } {
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { people: [], error: "Personnel could not be read. Reload and try again." }; }
  if (!Array.isArray(value) || value.length > 50) return { people: [], error: "Use no more than 50 personnel entries." };
  const people: ShowPerson[] = [];
  const ids = new Set<string>();
  for (const [position, entry] of value.entries()) {
    if (!entry || typeof entry !== "object") return { people, error: "Invalid personnel entry." };
    const fields = ["role", "name", "company", "email", "phone", "notes"] as const;
    if (fields.some((key) => typeof entry[key] !== "string") || typeof entry.primary !== "boolean" || typeof entry.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.id) || ids.has(entry.id)) {
      return { people, error: "Invalid or duplicate personnel entry." };
    }
    ids.add(entry.id);
    const person: ShowPerson = { id: entry.id, role: entry.role.trim(), name: entry.name.trim(), company: entry.company.trim(), email: entry.email.trim(), phone: entry.phone.trim(), notes: entry.notes.trim(), primary: entry.primary, position };
    people.push(person);
    if (!person.name || !person.role) return { people, error: `Person ${position + 1} needs a name and role.` };
    if (person.name.length > 160 || person.role.length > 120 || person.company.length > 160 || person.email.length > 254 || person.phone.length > 80 || person.notes.length > 2000) return { people, error: `Person ${position + 1} has a field that is too long.` };
    if (person.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(person.email)) return { people, error: `Person ${position + 1} needs a valid email address.` };
  }
  return { people };
}
