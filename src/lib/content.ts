import type { AppRole, EntityKind, ManagedRecord } from "@/lib/types";
import { referenceCollections } from "./references.ts";
import { fixtureIpRatings } from "./fixture-physical.ts";

export const contentStatuses = ["draft", "submitted", "published", "archived"] as const;
export const napkinStatuses = ["raw", "needs_review", "converted", "archived"] as const;
export const filingDestinationKinds = ["fixture", "show", "link", "location", "drink"] as const;
export type FilingDestinationKind = (typeof filingDestinationKinds)[number];

export const fixtureTypeOptions = [
  "Mover Spot",
  "Mover Wash",
  "Mover Profile",
  "Mover Strip",
  "Mover FX",
  "Gimmick/FX Light",
  "Battens & Tubes",
  "LED Striplight",
  "LED Leko",
  "LED Fresnel",
  "LED Soft",
  "LED Brick/Wash",
  "LED PAR",
  "LED-Punch Light",
  "LED Space",
  "LED Strobe/Blinder",
  "Conventional Striplight",
  "Conventional Leko",
  "Conventional Fresnel",
  "Conventional Soft",
  "Conventional Brick/Wash",
  "Conventional PAR",
  "Conventional Space",
  "Conventional Strobe/Blinder",
].map((value) => ({ value, label: value }));

export const fixturePowerInputOptions = [
  "powerCON TRUE1",
  "powerCON Blue/Gray",
  "Edison",
  "Stage Pin",
  "Twist-Lock / L5-15",
  "Twist-Lock / L6-20",
  "IEC",
  "Hardwired",
  "Other",
].map((value) => ({ value, label: value }));

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
  type: "text" | "textarea" | "url" | "number" | "date" | "select" | "checkbox" | "boolean-select";
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
      { name: "manufacturer", label: "Manufacturer", type: "text", required: true, maxLength: 120, help: "Choose the canonical manufacturer; aliases are searchable." },
      { name: "fixture_type", label: "Fixture type", type: "select", required: true, options: [
        { value: "", label: "Choose a fixture type" },
        ...fixtureTypeOptions,
      ] },
      { name: "preferred_mode", label: "LDG preferred mode", type: "text", maxLength: 160 },
      { name: "dmx_footprint", label: "DMX Footprint in Preferred Mode", type: "number", help: "Positive channel count." },
      { name: "wattage", label: "Wattage", type: "number", help: "Optional explicit power consumption in watts; decimals allowed and must be greater than 0." },
      { name: "weight_lb", label: "Weight (lb)", type: "number", help: "Optional weight in pounds; decimals allowed, greater than 0 and at most 10,000 lb." },
      { name: "ip_rating", label: "IP Rating", type: "select", options: [{ value: "", label: "Not specified" }, ...fixtureIpRatings.map((value) => ({ value, label: value }))] },
      { name: "power_input_connector", label: "Power input", type: "select", options: [
        { value: "", label: "Choose a power connection" },
        ...fixturePowerInputOptions,
      ] },
      { name: "power_passthrough", label: "Power passthrough", type: "boolean-select", help: "Can another fixture be powered from this fixture?" },
      { name: "power_note", label: "Power notes", type: "textarea", maxLength: 4000, wide: true },
      { name: "control_note", label: "Data / control notes", type: "textarea", maxLength: 4000, wide: true },
      { name: "field_notes", label: "Field notes", type: "textarea", maxLength: 4000, wide: true },
      { name: "fixture_page_url", label: "Fixture Page Link", type: "url", placeholder: "https://…" },
      { name: "manual_url", label: "Manual Link", type: "url", placeholder: "https://…" },
      { name: "dmx_chart_url", label: "DMX Chart Link", type: "url", placeholder: "https://…" },
      { name: "ies_url", label: "IES File Link", type: "url", placeholder: "https://…" },
      { name: "photometrics_url", label: "Photometrics Link", type: "url", placeholder: "https://…" },
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
      { name: "studio_site", label: "Studio / Site", type: "text", maxLength: 240, placeholder: "AMV 26, Santa Monica Beach…", help: "Optional venue, studio or working site; separate from the city." },
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
    kind: "link", table: "link_items", route: "/links", singular: "Reference", plural: "Reference Hub",
    eyebrow: "Resources worth keeping", description: "Find references by collection, across systems, workflows, and ideas.",
    minimumCreateRole: "contributor", titleField: "label",
    fields: [
      { name: "url", label: "Authoritative URL", type: "url", placeholder: "https://…", help: "Optional. URL-less references retain notes, taxonomy, tags, and history.", wide: true },
      { name: "label", label: "Title / label", type: "text", maxLength: 160, help: "Required when no Authoritative URL is supplied; URL-only capture defaults to the host." },
      { name: "collection_id", label: "Collection", type: "select", options: [
        { value: "unsorted", label: "Unsorted" },
        ...referenceCollections.filter((item) => !item.parent_id && item.id !== "unsorted").map((item) => ({ value: item.id, label: item.name })),
      ] },
      { name: "subcollection_id", label: "Subcollection (optional)", type: "select", options: [
        { value: "", label: "Directly in collection" },
        ...referenceCollections.filter((item) => item.parent_id).map((item) => ({ value: item.id, label: item.name })),
      ] },
      { name: "date_added", label: "Date Added", type: "text", maxLength: 40, help: "Optional on capture. Preserve source dates using an ISO timestamp, e.g. 2022-05-03T14:00:00Z." },
      { name: "description", label: "Description", type: "textarea", maxLength: 2000, wide: true },
    ],
  },
  document: {
    // Dormant legacy metadata for recovery and old Napkin destination resolution only.
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
    kind: "vendor_client", table: "vendor_clients", route: "/vendors", singular: "Vendor / manufacturer", plural: "Vendors / Manufacturers",
    eyebrow: "Restricted directory", description: "Business and contact context for editors and administrators only.",
    minimumCreateRole: "editor", restricted: true, titleField: "name",
    fields: [
      { name: "name", label: "Organization Name", type: "text", required: true, maxLength: 160 },
      { name: "city", label: "City", type: "text", maxLength: 120 },
      { name: "kind", label: "Relationship", type: "select", required: true, options: [{ value: "vendor", label: "Vendor" }, { value: "manufacturer", label: "Manufacturer" }, { value: "client", label: "Client" }] },
      { name: "primary_contact", label: "Primary contact", type: "text", maxLength: 240 },
      { name: "notes", label: "Operational notes", type: "textarea", maxLength: 4000, wide: true },
    ],
  },
  napkin: {
    kind: "napkin", table: "napkin_notes", route: "/napkin", singular: "Napkin note", plural: "T.I.K.I. Napkin",
    eyebrow: "Working knowledge", description: "A forgiving landing place for useful information that is not clean, classified, or verified yet.",
    minimumCreateRole: "viewer", titleField: "body",
    fields: [
      { name: "body", label: "What should we remember?", type: "textarea", maxLength: 4000, wide: true },
      { name: "source_url", label: "Source URL", type: "url", placeholder: "https://…", wide: true },
      { name: "urgent", label: "Mark important", type: "checkbox" },
    ],
  },
};

export function getRecordTitle(kind: EntityKind, record: Record<string, unknown>) {
  const value = record[contentConfigs[kind].titleField];
  const title = typeof value === "string" && value.trim() ? value : kind === "napkin" && record.sketch_path ? "Sketch Napkin" : "Untitled";
  return kind === "napkin" && title.length > 92 ? `${title.slice(0, 92)}…` : title;
}

export function getRecordMeta(kind: EntityKind, record: Record<string, unknown>) {
  const strings = (...values: unknown[]) => values.filter((value): value is string => typeof value === "string" && value.length > 0);
  switch (kind) {
    case "fixture": return strings(record.manufacturer, record.fixture_type).join(" · ") || "Fixture details pending";
    case "show": return strings(record.job_number ? `Job ${record.job_number}` : null, record.client_name, record.location, record.studio_site).join(" · ") || "Show details pending";
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
