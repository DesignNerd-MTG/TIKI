import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  canAddFixtureManufacturer,
  findSimilarManufacturers,
  manufacturerMatchesQuery,
  normalizeManufacturerKey,
  slugifyManufacturer,
} from "../src/lib/fixture-manufacturers.ts";
import { contentConfigs, fixtureTypeOptions } from "../src/lib/content.ts";

const manufacturers = [
  { id: "1", name: "Chauvet DJ", slug: "chauvet-dj", active: true, aliases: ["CHAUVET DJ"] },
  { id: "2", name: "Chauvet Professional", slug: "chauvet-professional", active: true, aliases: ["Chauvet Pro"] },
  { id: "3", name: "High End Systems", slug: "high-end-systems", active: true, aliases: ["HES", "High End"] },
  { id: "4", name: "Martin", slug: "martin", active: true, aliases: ["Martin Lighting", "Martin Professional"] },
  { id: "5", name: "ADJ", slug: "adj", active: true, aliases: ["American DJ"] },
  { id: "6", name: "Elation", slug: "elation", active: true, aliases: [] },
  { id: "7", name: "ETC", slug: "etc", active: true, aliases: [] },
  { id: "8", name: "Vari-Lite", slug: "vari-lite", active: true, aliases: ["VL", "Vari Lite"] },
  { id: "9", name: "Strand", slug: "strand", active: true, aliases: [] },
];

describe("Fixture manufacturer taxonomy", () => {
  it("normalizes manufacturer keys and stable slugs without changing display spelling", () => {
    assert.equal(normalizeManufacturerKey("  Vari-Lite  "), "varilite");
    assert.equal(normalizeManufacturerKey("DMG Lumière / Rosco"), "dmglumiererosco");
    assert.equal(slugifyManufacturer("DMG Lumière / Rosco"), "dmg-lumiere-rosco");
  });

  it("searches canonical names and aliases while returning canonical records", () => {
    assert.equal(manufacturerMatchesQuery(manufacturers[2], "hes"), true);
    assert.equal(manufacturerMatchesQuery(manufacturers[7], "vari lite"), true);
    assert.equal(manufacturerMatchesQuery(manufacturers[0], "hes"), false);
  });

  it("prevents case-only and obvious field-language duplicates", () => {
    assert.deepEqual(findSimilarManufacturers("MARTIN", manufacturers).map((item) => item.name), ["Martin"]);
    assert.deepEqual(findSimilarManufacturers("Martin Lighting", manufacturers).map((item) => item.name), ["Martin"]);
    assert.deepEqual(findSimilarManufacturers("martin professional", manufacturers).map((item) => item.name), ["Martin"]);
  });

  it("blocks plain Chauvet as ambiguous but keeps the two canonical lines separate", () => {
    assert.deepEqual(findSimilarManufacturers("Chauvet", manufacturers).map((item) => item.name), ["Chauvet DJ", "Chauvet Professional"]);
    assert.notEqual(normalizeManufacturerKey(manufacturers[0].name), normalizeManufacturerKey(manufacturers[1].name));
  });

  it("keeps field-recognizable brands distinct", () => {
    for (const pair of [["ADJ", "Elation"], ["ETC", "High End Systems"], ["Vari-Lite", "Strand"]]) {
      assert.ok(manufacturers.some((item) => item.name === pair[0]));
      assert.ok(manufacturers.some((item) => item.name === pair[1]));
      assert.notEqual(normalizeManufacturerKey(pair[0]), normalizeManufacturerKey(pair[1]));
    }
  });

  it("permits Editor and Admin additions but not lower roles", () => {
    assert.equal(canAddFixtureManufacturer("viewer"), false);
    assert.equal(canAddFixtureManufacturer("contributor"), false);
    assert.equal(canAddFixtureManufacturer("editor"), true);
    assert.equal(canAddFixtureManufacturer("admin"), true);
  });

  it("uses a required canonical selector and server-side authorization", async () => {
    const editor = await readFile(new URL("../src/components/manufacturer-selector.tsx", import.meta.url), "utf8");
    const action = await readFile(new URL("../src/app/(portal)/content-actions.ts", import.meta.url), "utf8");
    const field = contentConfigs.fixture.fields.find((item) => item.name === "manufacturer");
    assert.equal(field?.required, true);
    assert.match(editor, /Search manufacturers or aliases/);
    assert.match(editor, /Add Manufacturer/);
    assert.match(editor, /manufacturer_id/);
    assert.match(action, /hasMinimumRole\(profile\.role, "editor"\)/);
    assert.match(action, /findSimilarManufacturers/);
    assert.match(action, /fixture_manufacturers/);
  });

  it("seeds every requested manufacturer and no plain Chauvet canonical value", async () => {
    const sql = await readFile(new URL("../supabase/migrations/202609140013_fixture_manufacturer_taxonomy.sql", import.meta.url), "utf8");
    const requested = ["ACME", "ADJ", "Altman", "Aputure", "ARRI", "Astera", "Ayrton", "BB&S", "Chauvet DJ", "Chauvet Professional", "Chimera", "Chroma-Q", "Cineo", "CITC", "City Theatrical", "Claypaky", "Color Kinetics", "Creamsource", "DMG Lumière / Rosco", "Elation", "ETC", "Fiilex", "Froggy’s Fog", "GLP", "High End Systems", "JEM", "Kino Flo", "LiteGear", "Litepanels", "Look Solutions", "LumenRadio", "Lycian", "Martin", "MDG", "Mega-Lite", "Nanlite", "Nanlux", "PROLIGHTS", "Quasar Science", "Reel EFX", "Robe", "Rosco", "SGM", "Smoke Factory", "Strand", "TMB / Solaris", "Ultratec", "Vari-Lite"];
    for (const name of requested) assert.match(sql, new RegExp(`\\('${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace("'", "''")}',`));
    assert.doesNotMatch(sql, /\('Chauvet',/);
  });

  it("shows only the new exact category label", () => {
    assert.equal(fixtureTypeOptions.some((option) => option.value === "Battens & Tubes"), true);
    assert.equal(fixtureTypeOptions.some((option) => option.value === "Wash Bricks"), false);
  });
});
