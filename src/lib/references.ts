export const referenceCollections = [
  {
    "id": "ldg-ldge-documents",
    "name": "LDG / LDGE Documents",
    "description": "Internal company documents, forms, policies, templates, handbooks, and shared operational resources.",
    "parent_id": null
  },
  {
    "id": "control-systems",
    "name": "Control Systems",
    "description": "Consoles, nodes, manufacturer software, firmware, networking tools, and ecosystem-specific resources.",
    "parent_id": null
  },
  {
    "id": "consoles",
    "name": "Consoles",
    "description": "Console hardware, platform resources, support pages, and system-specific references.",
    "parent_id": "control-systems"
  },
  {
    "id": "nodes-networking",
    "name": "Nodes & Networking",
    "description": "Gateways, nodes, network processors, protocols, and infrastructure resources.",
    "parent_id": "control-systems"
  },
  {
    "id": "manufacturer-downloads",
    "name": "Manufacturer Software / Downloads",
    "description": "Official software, offline editors, configurators, firmware tools, and download pages.",
    "parent_id": "control-systems"
  },
  {
    "id": "fixtures-firmware",
    "name": "Fixtures & Firmware",
    "description": "Fixture families, firmware resources, manufacturer tools, and general fixture-reference material.",
    "parent_id": null
  },
  {
    "id": "drafting",
    "name": "Drafting",
    "description": "Vectorworks, CAD, plugins, templates, symbols, and drafting workflow resources.",
    "parent_id": null
  },
  {
    "id": "technical-reference",
    "name": "Technical Reference",
    "description": "Charts, symbols, standards, reference sheets, and technical information that does not belong to a specific system.",
    "parent_id": null
  },
  {
    "id": "software-utilities",
    "name": "Software / Web Utilities",
    "description": "Standalone apps and web tools for troubleshooting, testing, conversion, capture, and field utility.",
    "parent_id": null
  },
  {
    "id": "useful-products",
    "name": "Useful Products",
    "description": "Physical tools, adapters, hardware, and oddball products worth remembering.",
    "parent_id": null
  },
  {
    "id": "press-room",
    "name": "Press Room",
    "description": "Articles, interviews, features, and coverage about LDG, the team, or our work.",
    "parent_id": null
  },
  {
    "id": "inspiration",
    "name": "Inspiration",
    "description": "Visual references, clever ideas, interesting work, and things worth saving for creative reference.",
    "parent_id": null
  },
  {
    "id": "bucket-fun",
    "name": "Bucket o’ Fun",
    "description": "Weird, funny, frivolous, or otherwise delightful things that deserve to survive.",
    "parent_id": null
  },
  {
    "id": "unsorted",
    "name": "Unsorted",
    "description": "Stuff worth saving before anyone decides where it belongs.",
    "parent_id": null
  }
] as const;

export function referenceCollection(id: unknown) {
  return referenceCollections.find((item) => item.id === id);
}

export const legacyCollectionMap: Record<string, string> = {
  "Fixtures & Firmware": "fixtures-firmware", "Consoles/Nodes/Software": "control-systems",
  "Reference": "technical-reference", "Drafting": "drafting", "Misc": "bucket-fun",
  "Articles": "press-room", "Inspiration": "inspiration", "Utility": "software-utilities",
  "Useful Products": "useful-products", "Unsorted": "unsorted",
};

export const healthLabels: Record<string, string> = {
  healthy: "Healthy", redirected: "Redirected", could_not_verify: "Couldn’t Verify", unavailable: "Unavailable",
};

export function collectionLabel(collection: unknown, subcollection?: unknown) {
  return [referenceCollection(collection)?.name, referenceCollection(subcollection)?.name].filter(Boolean).join(" / ") || "Unsorted";
}

export function validCollectionPair(collection: string, subcollection: string) {
  const parent = referenceCollection(collection);
  return Boolean(parent && !parent.parent_id && (!subcollection || referenceCollection(subcollection)?.parent_id === collection));
}

export function isReferenceTimestamp(value: string) {
  // Require the original timezone, and reject dates that JS silently rolls over.
  const match = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const date = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`);
  return date.getUTCMonth() + 1 === Number(match[2]) && date.getUTCDate() === Number(match[3]);
}

export function referenceDefaults(input: Record<string, string | boolean>, now = new Date().toISOString()) {
  const next = { ...input };
  if (!String(next.label ?? "").trim()) {
    try { next.label = new URL(String(next.url)).hostname; } catch { next.label = ""; }
  }
  next.collection_id = String(next.collection_id || "unsorted");
  next.subcollection_id = String(next.subcollection_id || "");
  next.date_added = String(next.date_added || now);
  next.category = collectionLabel(next.collection_id, next.subcollection_id);
  return next;
}
