import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { parseGdtf, gdtfLimits } from "../src/lib/gdtf.ts";
import { gdtfPrefill, selectedGdtfMode, resolveGdtfManufacturer } from "../src/lib/gdtf-review.ts";
import { kilogramsToPounds } from "../src/lib/fixture-physical.ts";
import { channelXml, modeXml, gdtfXml, gdtfZip, zipFixture } from "./gdtf-fixture.mjs";

const parse = (xml, options) => parseGdtf(gdtfZip(xml, options), "fixture.gdtf");
const manufacturers = [
  { id: "hes", name: "High End Systems", active: true, aliases: ["HES"] },
  { id: "pro", name: "Chauvet Professional", active: true, aliases: ["Chauvet Pro"] },
  { id: "dj", name: "Chauvet DJ", active: true, aliases: [] },
];

describe("Safe GDTF review", () => {
  it("reads actual name/manufacturer/description and physical kg weight", async () => {
    const review = await parse(gdtfXml('<PhysicalDescriptions><Properties><Weight Value="24.3"/></Properties></PhysicalDescriptions>', 'Name="Short" LongName="Full model" Manufacturer="HES" Description="Source description"'));
    assert.equal(review.name, "Full model"); assert.equal(review.manufacturer, "HES"); assert.equal(review.description, "Source description");
    assert.ok(Math.abs(review.weightLb - kilogramsToPounds(24.3)) < 1e-9);
    assert.equal(gdtfPrefill(review, manufacturers, "").manufacturer_id, "hes");
  });
  it("computes sparse/coarse/fine addresses rather than counting logical/channel nodes", async () => {
    const review = await parse(gdtfXml(`<DMXModes>${modeXml("Basic", channelXml("1,2") + channelXml("10") + channelXml("None"))}${modeXml("Extended", channelXml("3,4,5,6") + channelXml("49"))}</DMXModes>`));
    assert.deepEqual(review.modes.map((mode) => [mode.name, mode.footprint]), [["Basic", 10], ["Extended", 49]]);
    assert.equal(selectedGdtfMode(review.modes, ""), null);
    assert.equal(gdtfPrefill(review, manufacturers, "").preferred_mode, "");
    assert.equal(gdtfPrefill(review, manufacturers, "1").dmx_footprint, 49);
    assert.equal(gdtfPrefill(review, manufacturers, "1").preferred_mode, "Extended");
    assert.equal(selectedGdtfMode(review.modes, "manual"), null);
    assert.equal(selectedGdtfMode(review.modes, "200"), null);
  });
  it("does not count ChannelFunctions or virtual channels as extra addresses", async () => {
    const review = await parse(gdtfXml(`<DMXModes>${modeXml("Mode", '<DMXChannel Offset="1"><LogicalChannel><ChannelFunction/><ChannelFunction/></LogicalChannel></DMXChannel><DMXChannel/>')}</DMXModes>`));
    assert.equal(review.modes[0].footprint, 1);
  });
  it("resolves exact canonical names and aliases, never unknown or ambiguous names", () => {
    assert.equal(resolveGdtfManufacturer("CHAUVET Professional", manufacturers)?.id, "pro");
    assert.equal(resolveGdtfManufacturer("HES", manufacturers)?.id, "hes");
    for (const name of ["Chauvet", "Unknown maker", "", "High End Systems Extra"]) assert.equal(resolveGdtfManufacturer(name, manufacturers), null);
    assert.equal(resolveGdtfManufacturer("HES", [...manufacturers, { id: "dup", name: "Other", active: true, aliases: ["HES"] }]), null);
    assert.equal(resolveGdtfManufacturer("HES", manufacturers.map((m) => ({ ...m, active: false }))), null);
  });
  it("allows missing optional fields and missing manufacturer/name/modes without fabrication", async () => {
    const review = await parse(gdtfXml("", ""));
    assert.equal(review.name, ""); assert.equal(review.manufacturer, ""); assert.equal(review.weightLb, null); assert.deepEqual(review.modes, []);
    assert.equal(gdtfPrefill(review, manufacturers, "manual").ip_rating, "");
    assert.ok(review.warnings.some((message) => message.includes("IP Rating")));
  });
  it("leaves unreliable IP and unrelated physical data blank", async () => {
    const review = await parse(gdtfXml('<Geometries><Geometry Weight="9" IP="IP65"/></Geometries>', 'Name="Lamp" IP="IP67"'));
    assert.equal(review.weightLb, null); assert.equal(gdtfPrefill(review, [], "").ip_rating, "");
  });
  it("accepts valid deflated XML", async () => {
    assert.equal((await parse(gdtfXml(), { deflate: true })).name, "Synthetic");
  });
  it("leaves unsupported versions usable for metadata review, not numeric prefill", async () => {
    const review = await parse(gdtfXml(`<PhysicalDescriptions><Properties><Weight Value="5"/></Properties></PhysicalDescriptions><DMXModes>${modeXml("Mode", channelXml("1,2"))}</DMXModes>`, 'Name="Future"', "99"));
    assert.equal(review.name, "Future"); assert.equal(review.weightLb, null); assert.equal(review.modes[0].footprint, null);
  });
  it("invalid optional weights do not discard useful metadata", async () => {
    for (const value of ["-1", "0", "NaN", "Infinity", "3 lb", "1000000", "1e999"]) {
      const review = await parse(gdtfXml(`<PhysicalDescriptions><Properties><Weight Value="${value}"/></Properties></PhysicalDescriptions>`));
      assert.equal(review.weightLb, null); assert.equal(review.name, "Synthetic");
    }
  });
  it("defers multi-break, Overwrite and geometry-reference footprints instead of guessing", async () => {
    for (const [body, expected] of [
      [`<DMXModes>${modeXml("Multi", channelXml("1,2", "1") + channelXml("3", "2"))}</DMXModes>`, /Multiple DMX breaks/],
      [`<DMXModes>${modeXml("Ref", channelXml("1", "Overwrite"))}</DMXModes>`, /DMX break/],
      [`<Geometries><Geometry Name="Base"><GeometryReference Geometry="Pixel"><Break DMXOffset="20"/></GeometryReference></Geometry></Geometries><DMXModes>${modeXml("Pixel", channelXml("1,2"))}</DMXModes>`, /Geometry references/],
    ]) { const review = await parse(gdtfXml(body)); assert.equal(review.modes[0].footprint, null); assert.match(review.modes[0].warning, expected); }
  });
  it("malformed, overlapping and virtual-only channels produce a review warning", async () => {
    for (const offsets of ["0", "513", "1,,3", "junk", "1,1", "1,2,3,4,5", "None"]) {
      const review = await parse(gdtfXml(`<DMXModes>${modeXml("Check", channelXml(offsets))}</DMXModes>`));
      assert.equal(review.modes[0].footprint, null); assert.ok(review.modes[0].warning);
    }
  });
  it("truncates metadata without splitting emoji and does not resolve truncated manufacturers", async () => {
    const review = await parse(gdtfXml("", `Name="${"x".repeat(159)}😀" Manufacturer="${"HES" + " ".repeat(118)}X" Description="${"x".repeat(3999)}😀"`));
    assert.equal(review.name.length, 159); assert.equal(review.description.length, 3999); assert.ok(review.name.isWellFormed()); assert.ok(review.description.isWellFormed()); assert.equal(review.manufacturer, "");
  });
  it("rejects malformed ZIP, wrong extension, empty and oversized uploads", async () => {
    await assert.rejects(() => parseGdtf(Buffer.from("bad zip"), "bad.gdtf"), /ZIP archive/);
    await assert.rejects(() => parseGdtf(gdtfZip(gdtfXml()), "bad.xml"), /\.gdtf/);
    await assert.rejects(() => parseGdtf(Buffer.alloc(0), "bad.gdtf"), /non-empty/);
    await assert.rejects(() => parseGdtf(Buffer.alloc(gdtfLimits.upload + 1), "bad.gdtf"), /2 MB/);
  });
  it("rejects absent root XML and duplicate archive entries", async () => {
    await assert.rejects(() => parseGdtf(zipFixture([{ name: "folder/description.xml", data: gdtfXml() }]), "bad.gdtf"), /archive root/);
    await assert.rejects(() => parseGdtf(zipFixture([{ name: "description.xml", data: gdtfXml() }, { name: "DESCRIPTION.XML", data: gdtfXml() }]), "bad.gdtf"), /duplicate/);
  });
  it("rejects traversal, absolute paths, backslashes, drive paths, symlinks and encryption", async () => {
    for (const entry of [
      { name: "../evil" }, { name: "/evil" }, { name: "folder\\evil" }, { name: "C:/evil" },
      { name: "symlink", attributes: (0xa1ff << 16) >>> 0 }, { name: "secret", flags: 1 },
    ]) await assert.rejects(() => parseGdtf(zipFixture([{ name: "description.xml", data: gdtfXml() }, { data: "x", ...entry }]), "bad.gdtf"));
  });
  it("bounds ratio, entry count, XML bytes and declared total expansion", async () => {
    await assert.rejects(() => parse(gdtfXml("x".repeat(100000)), { deflate: true }), /expansion/);
    await assert.rejects(() => parse("x".repeat(gdtfLimits.xml + 1)), /1 MB/);
    await assert.rejects(() => parseGdtf(zipFixture(Array.from({ length: 1025 }, (_, i) => ({ name: `file${i}` }))), "bad.gdtf"), /entries/);
    await assert.rejects(() => parseGdtf(zipFixture([{ name: "description.xml", data: gdtfXml() }, { name: "bomb", data: "x", size: gdtfLimits.expanded + 1, deflate: true }]), "bad.gdtf"), /expansion/);
  });
  it("checks CRC and expanded-size integrity", async () => {
    await assert.rejects(() => parse(gdtfXml(), { crc: 0 }), /integrity/);
    await assert.rejects(() => parse(gdtfXml(), { deflate: true, size: 20 }), /damaged/);
  });
  it("rejects malformed XML, multiple fixture roots, invalid UTF8 and invalid Unicode", async () => {
    for (const xml of ["<GDTF>", "<Other/>", '<GDTF><FixtureType/><FixtureType/></GDTF>', gdtfXml("", 'Name="&#xD800;"'), gdtfXml("", 'Name="&#0;"')]) await assert.rejects(() => parse(xml));
    await assert.rejects(() => parse(Buffer.from([0xc3, 0x28])), /UTF-8/);
  });
  it("rejects DOCTYPE, external entities and processing instructions without fetching", async () => {
    for (const xml of ['<!DOCTYPE GDTF [<!ENTITY x SYSTEM "http://127.0.0.1/private">]><GDTF><FixtureType Name="&x;"/></GDTF>', '<!DOCTYPE GDTF [<!ENTITY x "boom">]><GDTF><FixtureType/></GDTF>', '<?xml-stylesheet href="https://example.com/x"?><GDTF><FixtureType/></GDTF>']) await assert.rejects(() => parse(xml), /not allowed/);
    await assert.rejects(() => parse(gdtfXml("", 'Name="&unknown;"')), /malformed/);
  });
  it("limits XML depth, node count, attributes and mode count", async () => {
    await assert.rejects(() => parse(gdtfXml("<Nested>".repeat(65) + "</Nested>".repeat(65))), /complexity/);
    await assert.rejects(() => parse(gdtfXml("<N/>".repeat(20001))), /complexity/);
    await assert.rejects(() => parse(gdtfXml("", Array.from({ length: 65 }, (_, i) => `a${i}="x"`).join(" "))), /complexity/);
    await assert.rejects(() => parse(gdtfXml(`<DMXModes>${modeXml("Mode", "").repeat(129)}</DMXModes>`)), /128/);
  });
  it("does not process archive images, executable payloads or external resource URLs", async () => {
    const data = zipFixture([{ name: "description.xml", data: gdtfXml("", 'Name="Image" Thumbnail="https://127.0.0.1/private"') }, { name: "image.svg", data: '<svg onload="evil()"/>' }, { name: "evil.js", data: 'throw new Error("executed")' }]);
    const review = await parseGdtf(data, "image.gdtf"); assert.equal(review.name, "Image"); assert.ok(review.warnings.some((message) => message.includes("thumbnail")));
  });
  it("routes review through contributor authorization and never persists in upload action", async () => {
    const action = await readFile(new URL("../src/app/(portal)/fixtures/new/gdtf-action.ts", import.meta.url), "utf8");
    assert.match(action, /requireActiveProfile\("contributor"\)/); assert.doesNotMatch(action, /\.insert\(|\.update\(|\.upload\(|service_role|console\./);
    const ui = await readFile(new URL("../src/components/fixture-create.tsx", import.meta.url), "utf8");
    assert.match(ui, /Add Manually/); assert.match(ui, /Import GDTF/); assert.match(ui, /useState\(""\)/); assert.match(ui, /disabled=\{!selection\}/); assert.match(ui, /initialValues=\{gdtfPrefill/); assert.doesNotMatch(ui, /record=/);
  });
});
