import assert from "node:assert/strict";
import { it } from "node:test";
import { parseGdtf, gdtfLimits } from "../src/lib/gdtf.ts";
import { gdtfPrefill, resolveGdtfManufacturer, validateGdtfUpload } from "../src/lib/gdtf-review.ts";
import { formatFixtureWeight, kilogramsToPounds } from "../src/lib/fixture-physical.ts";
import { validateContentInput } from "../src/lib/content-validation.ts";
import { gdtfZip, gdtfXml, zipFixture } from "./gdtf-fixture.mjs";

it("accepts under/exact 4 MB and rejects over 4 MB without expanding XML limits", async () => {
  const xml = gdtfXml();
  const entries = [{ name: "description.xml", data: xml }, { name: "models/padding", data: "" }];
  const overhead = zipFixture(entries).length;
  for (const size of [3 * 1024 * 1024, gdtfLimits.upload]) {
    const buffer = zipFixture([entries[0], { ...entries[1], data: Buffer.alloc(size - overhead) }]);
    assert.equal(buffer.length, size); assert.equal((await parseGdtf(buffer, "realistic.gdtf")).name, "Synthetic");
  }
  assert.equal(gdtfLimits.upload, 4194304);
  assert.equal(gdtfLimits.xml, 1048576); assert.equal(gdtfLimits.expanded, 33554432);
  assert.equal(gdtfLimits.ratio, 200); assert.equal(gdtfLimits.entries, 1024);
  await assert.rejects(() => parseGdtf(Buffer.alloc(4194305), "large.gdtf"), /no larger than 4 MB/);
  assert.match(validateGdtfUpload({ size: 4194305, name: "large.gdtf" }), /no larger than 4 MB/);
});
it("accepts exactly one wrapper, verifies its CRC and applies the same inner XML rules", async () => {
  const inner = gdtfZip(gdtfXml());
  const wrapper = (entry) => zipFixture([{ name: "bundle/fixture.gdtf", data: inner, ...entry }]);
  assert.equal((await parseGdtf(wrapper({}), "fixture.gdtf.zip")).name, "Synthetic");
  assert.equal((await parseGdtf(wrapper({ deflate: true }), "FIXTURE.GDTF.ZIP")).name, "Synthetic");
  await assert.rejects(() => parseGdtf(wrapper({ crc: 0 }), "fixture.gdtf.zip"), /integrity/);
  await assert.rejects(() => parseGdtf(wrapper({ data: gdtfZip('<!DOCTYPE GDTF><GDTF/>') }), "fixture.gdtf.zip"), /not allowed/);
  await assert.rejects(() => parseGdtf(wrapper({ data: "not a GDTF" }), "fixture.gdtf.zip"), /ZIP archive/);
});
it("rejects empty/ambiguous/recursive/traversal wrappers, never choosing a fixture arbitrarily", async () => {
  const inner = gdtfZip(gdtfXml());
  for (const [entries, error] of [
    [[{ name: "readme.txt", data: "readme" }], /exactly one/],
    [[{ name: "a.gdtf", data: inner }, { name: "b.gdtf", data: inner }], /multiple GDTFs/],
    [[{ name: "another.gdtf.zip", data: inner }], /one outer ZIP/],
    [[{ name: "another.zip", data: inner }, { name: "a.gdtf", data: inner }], /one outer ZIP/],
    [[{ name: "../fixture.gdtf", data: inner }], /unsafe|damaged/],
    [[{ name: "fake.gdtf", data: zipFixture([{ name: "nested.gdtf", data: inner }]) }], /archive root/],
  ]) await assert.rejects(() => parseGdtf(zipFixture(entries), "fixture.gdtf.zip"), error);
});
it("counts wrapper and inner entries in one bounded expansion budget", async () => {
  const inner = zipFixture([{ name: "description.xml", data: gdtfXml() }, ...Array.from({ length: 600 }, (_, i) => ({ name: `inner${i}` }))]);
  const wrapper = zipFixture([{ name: "fixture.gdtf", data: inner }, ...Array.from({ length: 500 }, (_, i) => ({ name: `outer${i}` }))]);
  await assert.rejects(() => parseGdtf(wrapper, "fixture.gdtf.zip"), /expansion/);
});
it("Fiilex aliases are canonical and case-insensitive; description stays review-only", async () => {
  const manufacturers = [{ id: "fiilex", name: "Fiilex", active: true, aliases: ["Filex"] }];
  for (const manufacturer of ["Fiilex", "FIILEX", "fiilex", "Filex", "FILEX"]) {
    const review = await parseGdtf(gdtfZip(gdtfXml("", `Name="QUAD Color" Manufacturer="${manufacturer}" Description="3600W Motorized Fixture with a ton of punch..."`)), "fixture.gdtf");
    assert.equal(resolveGdtfManufacturer(review.manufacturer, manufacturers)?.name, "Fiilex");
    const prefill = gdtfPrefill(review, manufacturers, "manual");
    assert.equal(prefill.manufacturer, "Fiilex"); assert.equal(prefill.field_notes, ""); assert.match(review.description, /3600W/);
    assert.equal(Object.values(prefill).includes(review.description), false);
  }
  const saved = validateContentInput("fixture", "editor", { name: "Fixture", manufacturer: "Fiilex", fixture_type: "Battens & Tubes", field_notes: "Internal gotcha" });
  assert.equal(saved.valid, true); assert.equal(saved.payload.field_notes, "Internal gotcha");
});
it("formats pounds to one decimal without rounding stored or editable conversion", async () => {
  assert.equal(formatFixtureWeight(103.617263227), "103.6 lb"); assert.equal(formatFixtureWeight(46.999999999), "47.0 lb");
  const review = await parseGdtf(gdtfZip(gdtfXml('<PhysicalDescriptions><Properties><Weight Value="47"/></Properties></PhysicalDescriptions>')), "fixture.gdtf");
  assert.ok(Math.abs(review.weightLb - kilogramsToPounds(47)) < 1e-9);
  assert.equal(gdtfPrefill(review, [], "manual").weight_lb, review.weightLb);
  assert.equal(formatFixtureWeight(review.weightLb), "103.6 lb");
});
