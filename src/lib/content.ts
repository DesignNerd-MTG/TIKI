import type { AppRole, EntityKind, ManagedRecord } from "@/lib/types";

export const contentStatuses = ["draft", "submitted", "published", "archived"] as const;
export const napkinStatuses = ["raw", "needs_review", "converted", "archived"] as const;
export const filingDestinationKinds = ["fixture", "show", "link", "document", "location", "drink"] as const;
export type FilingDestinationKind = (typeof filingDestinationKinds)[number];

const countryDisplayNames = new Intl.DisplayNames(["en"], { type: "region" });
const countryCodes = `AF AL DZ AD AO AG AR AM AU AT AZ BS BH BD BB BY BE BZ BJ BT BO BA BW BR BN BG BF BI CV KH CM CA CF TD CL CN CO KM CG CD CR CI HR CU CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FJ FI FR GA GM GE DE GH GR GD GT GN GW GY HT HN HU IS IN ID IR IQ IE IL IT JM JP JO KZ KE KI KP KR KW KG LA LV LB LS LR LY LI LT LU MG MW MY MV ML MT MH MR MU MX FM MD MC MN ME MA MZ MM NA NR NP NL NZ NI NE NG MK NO OM PK PW PS PA PG PY PE PH PL PT QA RO RU RW KN LC VC WS SM ST SA SN RS SC SL SG SK SI SB SO ZA SS ES LK SD SR SE CH SY TW TJ TZ TH TL TG TO TT TN TR TM TV UG UA AE GB UY UZ VU VA VE VN YE ZM ZW XK`.split(" ");

export const countryOptions = [
  { value: "US", label: "United States" },
  ...countryCodes
    .filter((code) => code !== "US")
    .map((code) => ({ value: code, label: countryDisplayNames.of(code) ?? code }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

export function getCountryLabel(code: unknown) {
  if (typeof code !== "string" || !code) return "";
  return countryDisplayNames.of(code) ?? code;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  submitted: "Awaiting approval",
  published: "Published",
  raw: "Stored",
  needs_review: "Under review",
  converted: "Filed",
  archived: "Archived",
};

export function getStatusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

export type FieldDefinition = {
  name: string;
  label: string;
  type: "text" | "textarea" | "url" | "number" | "date" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
  help?: string;
  options?: Array<{ value: string; label: string }>;
  wide?: boolean;
  maxLength?: number;
};

export type ContentConfig = {
  kind: EntityKind;
  table: string;
  route: string;
  singular: string;
  plural: string;
  eyebrow: string;
  description: string;
  minimumCreateRole: AppRole;
  restricted?: boolean;
  titleField: string;
  fields: FieldDefinition[];
};

export const contentConfigs: Record<EntityKind, ContentConfig> = {
  fixture: {
    kind: "fixture", table: "fixtures", route: "/fixtures", singular: "Fixture", plural: "Fixtures",
    eyebrow: "Published knowledge", description: "Answer-first fixture references: preferred modes, DMX charts, documents, and field-proven notes.",
    minimumCreateRole: "contributor", titleField: "name",
    fields: [
      { name: "name", label: "Fixture name", type: "text", required: true, maxLength: 160 },
      { name: "manufacturer", label: "Manufacturer", type: "text", maxLength: 120 },
      { name: "fixture_type", label: "Fixture type", type: "text", maxLength: 120 },
      { name: "preferred_mode", label: "LDG preferred mode", type: "text", maxLength: 160 },
      { name: "dmx_footprint", label: "DMX Footprint in Preferred Mode", type: "number", help: "Positive channel count." },
      { name: "power_note", label: "Power notes", type: "textarea", maxLength: 4000, wide: true },
      { name: "control_note", label: "Data / control notes", type: "textarea", maxLength: 4000, wide: true },
      { name: "field_notes", label: "Field notes", type: "textarea", maxLength: 4000, wide: true },
      { name: "fixture_page_url", label: "Fixture Page Link", type: "url", placeholder: "https://…" },
      { name: "manual_url", label: "Manual Link", type: "url", placeholder: "https://…" },
      { name: "dmx_chart_url", label: "DMX Chart Link", type: "url", placeholder: "https://…" },
      { name: "showfile_url", label: "Link to Showfile with Fixture Included", type: "url", placeholder: "https://…", wide: true },
    ],
  },
  show: {
    kind: "show", table: "shows", route: "/shows", singular: "Show", plural: "Shows",
    eyebrow: "Published knowledge", description: "The clean index above existing show folders, key documents, reference files, and current links.",
    minimumCreateRole: "contributor", titleField: "title",
    fields: [
      { name: "title", label: "Show title", type: "text", required: true, maxLength: 160 },
      { name: "job_number", label: "Job number", type: "text", maxLength: 80, placeholder: "LDG job or project number" },
      { name: "client_name", label: "Client", type: "text", maxLength: 160 },
      { name: "location", label: "Location", type: "text", maxLength: 240 },
      { name: "start_date", label: "Start date", type: "date" },
      { name: "end_date", label: "End date", type: "date" },
      { name: "summary", label: "Show summary", type: "textarea", maxLength: 4000, wide: true },
      { name: "dropbox_url", label: "Dropbox Link", type: "url", placeholder: "https://…" },
      { name: "egnyte_url", label: "Egnyte Link", type: "url", placeholder: "https://…" },
      { name: "staffing_notes", label: "Staffing / Crew Notes", type: "textarea", maxLength: 8000, wide: true },
      { name: "staffing_calendar_url", label: "Staffing Calendar", type: "url", placeholder: "https://…", wide: true },
    ],
  },
  link: {
    kind: "link", table: "link_items", route: "/links", singular: "Link", plural: "Link Hub",
    eyebrow: "Daily tools", description: "Fast routes to timesheets, expenses, downloads, show folders, and department systems.",
    minimumCreateRole: "contributor", titleField: "label",
    fields: [
      { name: "label", label: "Link label", type: "text", required: true, maxLength: 160 },
      { name: "category", label: "Category", type: "text", required: true, maxLength: 80, placeholder: "Operations" },
      { name: "url", label: "Authoritative URL", type: "url", required: true, placeholder: "https://…", wide: true },
      { name: "description", label: "Description", type: "textarea", maxLength: 2000, wide: true },
    ],
  },
  document: {
    kind: "document", table: "documents", route: "/documents", singular: "Document", plural: "Documents",
    eyebrow: "Published knowledge", description: "A searchable index of authoritative manuals, charts, paperwork, and external document locations.",
    minimumCreateRole: "contributor", titleField: "title",
    fields: [
      { name: "title", label: "Document title", type: "text", required: true, maxLength: 160 },
      { name: "document_type", label: "Document type", type: "text", maxLength: 100, placeholder: "Manual, plot, policy…" },
      { name: "url", label: "Authoritative document URL", type: "url", required: true, placeholder: "https://…", wide: true },
      { name: "description", label: "Description", type: "textarea", maxLength: 2000, wide: true },
    ],
  },
  location: {
    kind: "location", table: "locations", route: "/locations", singular: "Location", plural: "Locations",
    eyebrow: "Useful places", description: "Studios, restaurants, venues, hotels, and other places worth remembering.",
    minimumCreateRole: "contributor", titleField: "name",
    fields: [
      { name: "name", label: "Location name", type: "text", required: true, maxLength: 160 },
      { name: "kind", label: "Type", type: "select", required: true, options: [
        { value: "studio", label: "Studio" },
        { value: "restaurant", label: "Restaurant" },
        { value: "venue", label: "Venue" },
        { value: "hotel", label: "Hotel" },
        { value: "other", label: "Other" },
      ] },
      { name: "address", label: "Address", type: "text", maxLength: 300, wide: true },
      { name: "city", label: "City", type: "text", maxLength: 120 },
      { name: "region", label: "State / region", type: "text", maxLength: 120 },
      { name: "country", label: "Country", type: "select", required: true, options: countryOptions },
      { name: "phone", label: "Phone", type: "text", maxLength: 80 },
      { name: "website_url", label: "Website", type: "url", placeholder: "https://…" },
      { name: "map_url", label: "Map link", type: "url", placeholder: "https://…", wide: true },
      { name: "notes", label: "Why it matters", type: "textarea", maxLength: 4000, wide: true },
    ],
  },
  drink: {
    kind: "drink", table: "drinks", route: "/drinks", singular: "Drink", plural: "Drinks",
    eyebrow: "After the call", description: "Cocktail recipes worth keeping in the T.I.K.I. lounge.",
    minimumCreateRole: "contributor", titleField: "name",
    fields: [
      { name: "name", label: "Drink name", type: "text", required: true, maxLength: 160 },
      { name: "description", label: "Description", type: "textarea", maxLength: 1000, wide: true },
      { name: "ingredients", label: "Ingredients", type: "textarea", required: true, maxLength: 4000, wide: true, help: "One ingredient per line works best." },
      { name: "instructions", label: "Method", type: "textarea", maxLength: 4000, wide: true },
      { name: "glassware", label: "Glassware", type: "text", maxLength: 120 },
      { name: "garnish", label: "Garnish", type: "text", maxLength: 240 },
      { name: "source_url", label: "Source URL", type: "url", placeholder: "https://…", wide: true },
    ],
  },
  vendor_client: {
    kind: "vendor_client", table: "vendor_clients", route: "/vendors", singular: "Vendor / client", plural: "Vendors & clients",
    eyebrow: "Restricted area", description: "Sensitive operational context for editors and administrators only.",
    minimumCreateRole: "editor", restricted: true, titleField: "name",
    fields: [
      { name: "name", label: "Organization name", type: "text", required: true, maxLength: 160 },
      { name: "kind", label: "Relationship", type: "select", required: true, options: [{ value: "vendor", label: "Vendor" }, { value: "client", label: "Client" }] },
      { name: "primary_contact", label: "Primary contact", type: "text", maxLength: 240 },
      { name: "notes", label: "Operational notes", type: "textarea", maxLength: 4000, wide: true },
    ],
  },
  napkin: {
    kind: "napkin", table: "napkin_notes", route: "/napkin", singular: "Napkin note", plural: "T.I.K.I. Napkin",
    eyebrow: "Working knowledge", description: "A forgiving landing place for useful information that is not clean, classified, or verified yet.",
    minimumCreateRole: "viewer", titleField: "body",
    fields: [
      { name: "body", label: "What should we remember?", type: "textarea", required: true, maxLength: 4000, wide: true },
      { name: "source_url", label: "Source URL", type: "url", placeholder: "https://…", wide: true },
      { name: "urgent", label: "Mark important", type: "checkbox" },
    ],
  },
};

export function getRecordTitle(kind: EntityKind, record: Record<string, unknown>) {
  const value = record[contentConfigs[kind].titleField];
  const title = typeof value === "string" ? value : "Untitled";
  return kind === "napkin" && title.length > 92 ? `${title.slice(0, 92)}…` : title;
}

export function getRecordMeta(kind: EntityKind, record: Record<string, unknown>) {
  const strings = (...values: unknown[]) => values.filter((value): value is string => typeof value === "string" && value.length > 0);
  switch (kind) {
    case "fixture": return strings(record.manufacturer, record.fixture_type).join(" · ") || "Fixture details pending";
    case "show": return strings(record.job_number ? `Job ${record.job_number}` : null, record.client_name, record.location).join(" · ") || "Show details pending";
    case "link": return typeof record.category === "string" ? record.category : "General";
    case "document": return typeof record.document_type === "string" && record.document_type ? record.document_type : "Reference document";
    case "location": return strings(record.kind, record.city, record.region, record.country && record.country !== "US" ? getCountryLabel(record.country) : null).join(" · ") || "Location details pending";
    case "drink": return strings(record.glassware, record.garnish).join(" · ") || "Cocktail recipe";
    case "vendor_client": return strings(record.kind, record.primary_contact).join(" · ") || "Contact details pending";
    case "napkin": return record.urgent ? "Important field note" : "Working knowledge";
  }
}

export function getRecordDetail(kind: EntityKind, record: Record<string, unknown>) {
  const keys: Record<EntityKind, string[]> = {
    fixture: ["preferred_mode", "field_notes"], show: ["summary", "staffing_notes"], link: ["description"],
    document: ["description"], location: ["notes", "address"], drink: ["description", "ingredients"], vendor_client: ["notes"], napkin: ["source_url"],
  };
  for (const key of keys[kind]) {
    const value = record[key];
    if (typeof value === "string" && value) return value;
  }
  return null;
}

export function asManagedRecord(value: unknown): ManagedRecord | null {
  if (!value || typeof value !== "object" || !("id" in value)) return null;
  return value as ManagedRecord;
}
