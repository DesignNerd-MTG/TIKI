import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { validateContentInput } from "../src/lib/content-validation.ts";
import { contentConfigs, fixtureTypeOptions } from "../src/lib/content.ts";
import { fixtureIpRatings, fixtureQuickSpecs, kilogramsToPounds } from "../src/lib/fixture-physical.ts";

const base = { name: "Fixture", manufacturer: "ETC", fixture_type: "Battens & Tubes", status: "draft" };
describe("Fixture physical fields", () => {
  it("accepts decimal pounds, blank historical weight and correct kg conversion", () => {
    for (const value of ["53.6", "1", "0.5", ".25", "10000", ""]) {
      const result = validateContentInput("fixture", "contributor", { ...base, weight_lb: value });
      assert.equal(result.valid, true); assert.equal(result.payload.weight_lb, value ? Number(value) : null);
    }
    assert.equal(kilogramsToPounds(0.45359237), 1);
  });
  it("rejects negative/zero/nonsensical/oversized weights without loosening DMX validation", () => {
    for (const value of ["-2", "0", "Infinity", "NaN", "52 lbs", "0x20", "10001", "1e999"]) assert.equal(validateContentInput("fixture", "contributor", { ...base, weight_lb: value }).valid, false);
    assert.equal(validateContentInput("fixture", "contributor", { ...base, dmx_footprint: "2.5" }).valid, false);
  });
  it("accepts each controlled IP rating or blank and rejects arbitrary historical junk", () => {
    for (const value of [...fixtureIpRatings, ""]) {
      const result = validateContentInput("fixture", "contributor", { ...base, ip_rating: value });
      assert.equal(result.valid, true); assert.equal(result.payload.ip_rating, value || null);
    }
    for (const value of ["IP65+", "waterproof", "65", "IP99"]) assert.equal(validateContentInput("fixture", "editor", { ...base, ip_rating: value }, "draft", { ip_rating: value }).valid, false);
  });
  it("keeps manual create/edit, optional old records, links, Typical Use and categories intact", () => {
    const existing = { ...base, preferred_mode: "Mode A", dmx_footprint: "35", power_passthrough: "false", power_input_connector: "powerCON TRUE1 TOP", ies_url: "https://example.com/light.ies", photometrics_url: "https://example.com/photometrics", fixture_page_url: "https://example.com/fixture" };
    for (const previous of [undefined, "draft"]) {
      const result = validateContentInput("fixture", "contributor", existing, previous, existing);
      assert.equal(result.valid, true); assert.equal(result.payload.weight_lb, null); assert.equal(result.payload.ip_rating, null);
      assert.equal(result.payload.dmx_footprint, 35); assert.equal(result.payload.ies_url, existing.ies_url); assert.equal(result.payload.photometrics_url, existing.photometrics_url); assert.equal(result.payload.power_passthrough, false);
      assert.equal(Object.hasOwn(result.payload, "typical_use"), false);
    }
    for (const type of ["Battens & Tubes", "LED-Punch Light", "Mover Wash", "LED Brick/Wash"]) assert.ok(fixtureTypeOptions.some((option) => option.value === type));
  });
  it("uses editable fields in both forms and compact detail quick specs with lb units", async () => {
    for (const key of fixtureQuickSpecs) assert.ok(contentConfigs.fixture.fields.some((field) => field.name === key));
    const editor = await readFile(new URL("../src/components/content-editor.tsx", import.meta.url), "utf8");
    const pages = await readFile(new URL("../src/components/content-pages.tsx", import.meta.url), "utf8");
    assert.match(editor, /record \? record\[field.name\] : initialValues\[field.name\]/);
    assert.match(editor, /step=\{field.name === "weight_lb" \? "any"/);
    assert.match(pages, /Fixture quick specs/); assert.match(pages, /formatFixtureWeight\(stringify\(record\[key\]\)\)/);
  });
});
