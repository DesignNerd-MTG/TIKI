import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { contentConfigs, getRecordDetail, getRecordMeta, getRecordTitle, getStatusLabel } from "../src/lib/content.ts";
import { allowedStatuses, canArchiveContent, canCreateContent, canDeleteContent, canEditContent, canSetStatus } from "../src/lib/content-rules.ts";
import { buildSearchPattern, isSafeExternalUrl, isUuid, normalizeTags, slugifyTag, validateContentInput } from "../src/lib/content-validation.ts";
import { defaultTheme, isThemePreset, resolveTheme, themePresets } from "../src/lib/theme.ts";

const ownDraft = { created_by: "user-1", status: "draft" };
const ownPublished = { created_by: "user-1", status: "published" };
const otherDraft = { created_by: "user-2", status: "draft" };
const ownRaw = { created_by: "user-1", status: "raw" };

describe("content CRUD permissions", () => {
  it("allows viewers to capture Napkins but not create canonical records", () => {
    assert.equal(canCreateContent("viewer", "napkin"), true);
    assert.equal(canCreateContent("viewer", "fixture"), false);
  });

  it("allows contributors to create and update their own working records only", () => {
    assert.equal(canCreateContent("contributor", "fixture"), true);
    assert.equal(canCreateContent("contributor", "vendor_client"), false);
    assert.equal(canEditContent("contributor", "user-1", "fixture", ownDraft), true);
    assert.equal(canEditContent("contributor", "user-1", "fixture", ownPublished), false);
    assert.equal(canEditContent("contributor", "user-1", "fixture", otherDraft), false);
  });

  it("allows editors to manage content and reserves hard deletion for admins", () => {
    assert.equal(canEditContent("editor", "editor-1", "fixture", ownPublished), true);
    assert.equal(canCreateContent("editor", "vendor_client"), true);
    assert.equal(canArchiveContent("editor", "editor-1", "show", ownPublished), true);
    assert.equal(canDeleteContent("editor"), false);
    assert.equal(canDeleteContent("admin"), true);
  });

  it("lets an author edit and archive their own raw Napkin", () => {
    assert.equal(canEditContent("viewer", "user-1", "napkin", ownRaw), true);
    assert.equal(canArchiveContent("viewer", "user-1", "napkin", ownRaw), true);
    assert.equal(canEditContent("viewer", "user-2", "napkin", ownRaw), false);
  });
});

describe("content status workflow", () => {
  it("limits contributors to draft and submitted", () => {
    assert.deepEqual(allowedStatuses("contributor", "fixture"), ["draft", "submitted"]);
    assert.equal(canSetStatus("contributor", "fixture", "published"), false);
    assert.equal(canSetStatus("editor", "fixture", "published"), true);
  });

  it("uses the Napkin-specific intake statuses", () => {
    assert.deepEqual(allowedStatuses("viewer", "napkin"), ["raw"]);
    assert.deepEqual(allowedStatuses("editor", "napkin"), ["raw", "needs_review", "converted", "archived"]);
    assert.equal(canSetStatus("editor", "napkin", "converted"), true);
    assert.equal(canSetStatus("editor", "napkin", "assigned"), false);
    assert.equal(getStatusLabel("raw"), "Stored");
    assert.equal(getStatusLabel("needs_review"), "Under review");
    assert.equal(getStatusLabel("converted"), "Filed");
  });
});

describe("content validation and failure handling", () => {
  it("accepts a valid fixture and normalizes number and tags", () => {
    const result = validateContentInput("fixture", "contributor", {
      name: "MVP Test Fixture", manufacturer: "Test", fixture_type: "Wash", preferred_mode: "Extended",
      dmx_footprint: "32", typical_use: "Testing", power_note: "", control_note: "", field_notes: "",
      dmx_chart_url: "https://example.com/chart", manual_url: "", status: "draft", tags: "LED, led, Broadcast", revision_note: "Initial test record",
    });
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.payload.dmx_footprint, 32);
      assert.deepEqual(result.tags, ["LED", "Broadcast"]);
    }
  });

  it("returns field-specific errors for missing names and unsafe URLs", () => {
    const result = validateContentInput("document", "contributor", {
      title: "", document_type: "Manual", url: "javascript:alert(1)", description: "", status: "draft", tags: "", revision_note: "",
    });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.fieldErrors.title, /required/);
      assert.match(result.fieldErrors.url, /http/);
    }
  });

  it("keeps the vendor relationship separate from the record entity kind", () => {
    const result = validateContentInput("vendor_client", "editor", {
      name: "MVP Test Vendor", kind: "vendor", primary_contact: "QA", notes: "Temporary",
      status: "draft", tags: "mvp-test", revision_note: "",
    });
    assert.equal(result.valid, true);
    if (result.valid) assert.equal(result.payload.kind, "vendor");
  });

  it("rejects reversed show dates and unauthorized publishing", () => {
    const result = validateContentInput("show", "contributor", {
      title: "MVP Test Show", job_number: "LDG-260907", client_name: "", location: "", start_date: "2026-09-10", end_date: "2026-09-09",
      primary_link: "", summary: "", status: "published", tags: "", revision_note: "Trying to publish",
    });
    assert.equal(result.valid, false);
    if (!result.valid) {
      assert.match(result.fieldErrors.end_date, /on or after/);
      assert.match(result.fieldErrors.status, /cannot set/);
    }
  });

  it("requires an audit note when status changes", () => {
    const result = validateContentInput("link", "editor", {
      label: "Crew portal", category: "Operations", url: "https://example.com", description: "", status: "published", tags: "", revision_note: "",
    }, "draft");
    assert.equal(result.valid, false);
    if (!result.valid) assert.match(result.fieldErrors.revision_note, /status change/);
  });

  it("allows only complete HTTP(S) external URLs", () => {
    assert.equal(isSafeExternalUrl("https://example.com/manual.pdf"), true);
    assert.equal(isSafeExternalUrl("ftp://example.com/file"), false);
    assert.equal(isSafeExternalUrl("https://user:password@example.com/file"), false);
    assert.equal(isSafeExternalUrl("not-a-url"), false);
    assert.equal(isUuid("6f74ad18-fbce-4f1f-b69d-8b691c3e40c7"), true);
    assert.equal(isUuid("not-a-uuid"), false);
  });
});

describe("tags, search, and record presentation", () => {
  it("deduplicates tags and creates stable slugs", () => {
    assert.deepEqual(normalizeTags(" Lighting,lighting,  Show Site "), ["Lighting", "Show Site"]);
    assert.equal(slugifyTag("Show Site / 2026"), "show-site-2026");
  });

  it("neutralizes PostgREST filter punctuation in search input", () => {
    assert.equal(buildSearchPattern("  lamp,(status.eq.archived)  "), "%lamp status.eq.archived%" );
    assert.equal(buildSearchPattern("   "), "");
  });

  it("defines every MVP module and builds useful list copy", () => {
    assert.deepEqual(Object.keys(contentConfigs).sort(), ["document", "drink", "fixture", "link", "location", "napkin", "show", "vendor_client"]);
    const fixture = { name: "ColorForce", manufacturer: "Chroma-Q", fixture_type: "Batten", preferred_mode: "RGBA" };
    assert.equal(getRecordTitle("fixture", fixture), "ColorForce");
    assert.equal(getRecordMeta("fixture", fixture), "Chroma-Q · Batten");
    assert.equal(getRecordDetail("fixture", fixture), "RGBA");
    assert.equal(getRecordMeta("show", { job_number: "LDG-260907", client_name: "ESPN", location: "Bristol" }), "Job LDG-260907 · ESPN · Bristol");
    assert.equal(getRecordMeta("location", { kind: "studio", city: "New York", region: "NY" }), "studio · New York · NY");
    assert.equal(getRecordMeta("drink", { glassware: "Double rocks", garnish: "Mint" }), "Double rocks · Mint");
  });

  it("validates useful locations and cocktail recipes as canonical knowledge", () => {
    assert.equal(canCreateContent("viewer", "drink"), false);
    assert.equal(canCreateContent("contributor", "drink"), true);
    assert.equal(canCreateContent("contributor", "location"), true);

    const location = validateContentInput("location", "contributor", {
      name: "Useful Studio", kind: "studio", address: "1 Main St", city: "New York", region: "NY", phone: "",
      website_url: "https://example.com", map_url: "https://maps.example.com", notes: "Freight entrance on the west side.",
      status: "draft", tags: "studio", revision_note: "",
    });
    assert.equal(location.valid, true);

    const drink = validateContentInput("drink", "contributor", {
      name: "Mai Tai", description: "", ingredients: "1 oz lime\n2 oz rum", instructions: "Shake with ice.",
      glassware: "Double rocks", garnish: "Mint", source_url: "", status: "draft", tags: "rum", revision_note: "",
    });
    assert.equal(drink.valid, true);
  });

  it("accepts and limits show job numbers", () => {
    const valid = validateContentInput("show", "contributor", {
      title: "MVP Test Show", job_number: "LDG-260907", client_name: "ESPN", location: "Bristol",
      start_date: "", end_date: "", primary_link: "", summary: "", status: "draft", tags: "", revision_note: "",
    });
    assert.equal(valid.valid, true);
    if (valid.valid) assert.equal(valid.payload.job_number, "LDG-260907");

    const invalid = validateContentInput("show", "contributor", {
      title: "MVP Test Show", job_number: "J".repeat(81), client_name: "", location: "",
      start_date: "", end_date: "", primary_link: "", summary: "", status: "draft", tags: "", revision_note: "",
    });
    assert.equal(invalid.valid, false);
    if (!invalid.valid) assert.match(invalid.fieldErrors.job_number, /too long/);
  });
});

describe("Supabase RLS migration", () => {
  it("keeps contributor publishing blocked and polymorphic metadata protected", async () => {
    const sql = await readFile(new URL("../supabase/migrations/202609070001_content_management_mvp.sql", import.meta.url), "utf8");
    assert.match(sql, /status in \('draft', 'submitted'\)/);
    assert.match(sql, /can_read_content\(entity_kind, entity_id\)/);
    assert.match(sql, /can_edit_content\(entity_kind, entity_id\)/);
    assert.match(sql, /set_content_tags/);
    assert.doesNotMatch(sql, /service_role|sb_secret_/i);
  });

  it("protects the single global appearance row with admin-only updates", async () => {
    const sql = await readFile(new URL("../supabase/migrations/202609070002_site_appearance.sql", import.meta.url), "utf8");
    assert.match(sql, /id text primary key check \(id = 'global'\)/);
    assert.match(sql, /site_settings_admin_update/);
    assert.match(sql, /has_minimum_role\('admin'\)/);
    assert.doesNotMatch(sql, /service_role|sb_secret_/i);
  });

  it("adds the optional show job number without rewriting existing records", async () => {
    const sql = await readFile(new URL("../supabase/migrations/202609070003_show_job_number.sql", import.meta.url), "utf8");
    assert.match(sql, /add column if not exists job_number text/i);
    assert.match(sql, /char_length\(job_number\) <= 80/i);
    assert.doesNotMatch(sql, /update public\.shows|delete from public\.shows/i);
  });

  it("adds Locations and Drinks with protected repository access", async () => {
    const enumSql = await readFile(new URL("../supabase/migrations/202609070004_expand_relationship_kind.sql", import.meta.url), "utf8");
    const sql = await readFile(new URL("../supabase/migrations/202609070005_locations_drinks_napkin_workflow.sql", import.meta.url), "utf8");
    assert.match(enumSql, /add value if not exists 'location'/i);
    assert.match(enumSql, /add value if not exists 'drink'/i);
    assert.match(sql, /create table if not exists public\.locations/i);
    assert.match(sql, /create table if not exists public\.drinks/i);
    assert.match(sql, /locations_delete_admin/i);
    assert.match(sql, /drinks_delete_admin/i);
    assert.match(sql, /when 'location'/i);
    assert.match(sql, /when 'drink'/i);
    assert.doesNotMatch(sql, /service_role|sb_secret_/i);
  });

  it("turns the Napkin into a shared stored-review-filed repository", async () => {
    const sql = await readFile(new URL("../supabase/migrations/202609070005_locations_drinks_napkin_workflow.sql", import.meta.url), "utf8");
    const editor = await readFile(new URL("../src/components/content-editor.tsx", import.meta.url), "utf8");
    const navigation = await readFile(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
    assert.match(sql, /set status = 'needs_review', assigned_to = null/i);
    assert.match(sql, /status <> 'archived' or public\.has_minimum_role\('editor'\)/i);
    assert.doesNotMatch(editor, /Assigned to/);
    assert.match(editor, /Stored → Under review → Filed → Archived/);
    assert.match(navigation, /Pile of Napkins/);
    assert.match(navigation, /Napkin Queue/);
  });
});

describe("global appearance settings", () => {
  it("accepts only curated theme presets and falls back safely", () => {
    assert.equal(themePresets.length, 5);
    assert.equal(isThemePreset("lagoon"), true);
    assert.equal(isThemePreset("neon-user-color"), false);
    assert.equal(resolveTheme("night"), "night");
    assert.equal(resolveTheme("not-a-theme"), defaultTheme);
  });
});
