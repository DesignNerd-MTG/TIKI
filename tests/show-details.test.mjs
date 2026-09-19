import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import { moveShowPerson, orderShowPeople, readShowPeople, validateShowPeople } from "../src/lib/show-details.ts";
import { getShowCity, resolveShowLocation, searchShowCities } from "../src/lib/show-city-catalog.ts";
import { validateContentInput } from "../src/lib/content-validation.ts";

const person = (name, overrides = {}) => ({ id: crypto.randomUUID(), name, role: "Lighting Designer / LD", company: "", email: "", phone: "", notes: "", primary: false, position: 0, ...overrides });
describe("Show personnel and normalized locations", () => {
  it("allows a Show with no personnel, city, or site", () => {
    assert.equal(validateContentInput("show", "editor", { title: "New Show", status: "draft" }).valid, true);
    assert.deepEqual(validateShowPeople("[]"), { people: [] });
    assert.deepEqual(resolveShowLocation("", "city", ""), { location: null, location_data: null });
    assert.deepEqual(readShowPeople(undefined), []);
  });
  it("round-trips multiple people, custom roles, primary flags and user order", () => {
    const people = [person("Mike"), person("Jo", { role: "Show caller", primary: true, company: "Team", email: "jo@example.com", phone: "+1 555 0100", notes: "Call before load-in", position: 1 }), person("Pat", { position: 2 })];
    const moved = moveShowPerson(people, 2, -1);
    assert.deepEqual(moved.map((p) => p.name), ["Mike", "Pat", "Jo"]);
    assert.deepEqual(moved.map((p) => p.position), [0, 1, 2]);
    const saved = validateShowPeople(JSON.stringify(moved));
    assert.equal(saved.error, undefined);
    assert.deepEqual(saved.people, moved);
    assert.deepEqual(orderShowPeople(saved.people).map((p) => p.name), ["Jo", "Mike", "Pat"]);
    assert.deepEqual(validateShowPeople(JSON.stringify(moved.filter((p) => p.name !== "Pat"))).people.map((p) => p.position), [0, 1]);
    assert.deepEqual(moveShowPerson(moved, 0, -1), moved);
  });
  it("rejects bad rows and preserves all drafts for correction", () => {
    const people = [person(""), person("Keep me", { role: "Custom" })];
    assert.match(validateShowPeople(JSON.stringify(people)).error, /name and role/);
    assert.deepEqual(readShowPeople(JSON.stringify(people)), people);
    assert.match(validateShowPeople(JSON.stringify([person("Jo", { email: "bad" })])).error, /email/);
    const duplicate = person("Mike");
    assert.match(validateShowPeople(JSON.stringify([duplicate, duplicate])).error, /duplicate/);
    assert.ok(validateShowPeople("null").error);
    assert.ok(validateShowPeople("{").error);
    assert.ok(validateShowPeople(JSON.stringify(Array.from({ length: 51 }, () => person("Test")))).error);
  });
  it("finds canonical US/international cities, aliases, prefixes and coordinates", () => {
    assert.equal(searchShowCities("san mo")[0].display_name, "Santa Monica, CA");
    for (const [query, label] of [["san mo", "Santa Monica, CA"], ["nEw yOrK", "New York City, NY"], ["NYC", "New York City, NY"], ["Vegas", "Las Vegas, NV"], ["Everett WA", "Everett, WA"], ["London England", "London, England, UK"]]) {
      const city = searchShowCities(query).find((entry) => entry.display_name === label);
      assert.ok(city, `${query} → ${label}`);
      assert.ok(Number.isFinite(city.latitude) && Number.isFinite(city.longitude));
      assert.ok(city.region && city.country && city.country_code);
      assert.deepEqual(getShowCity(city.id), city);
      assert.equal(resolveShowLocation(city.id, "city", "arbitrary client label").location, label);
    }
  });
  it("does not autocomplete venues, landmarks or addresses", () => {
    for (const query of ["Chelsea Studios", "Santa Monica Beach", "AMV 26", "Angel of the Winds Arena", "Wolstein Center", "123 Main Street"]) assert.deepEqual(searchShowCities(query), [], query);
  });
  it("requires selection or explicit manual entry and preserves legacy text", () => {
    const longLegacy = "  " + "Original location ".repeat(20) + "  ";
    assert.equal(validateContentInput("show", "editor", { title: "Legacy", status: "draft", location: longLegacy }, "draft", { location: longLegacy }).valid, true);
    assert.equal(resolveShowLocation("", "manual", longLegacy, { location: longLegacy }).location, longLegacy);
    assert.ok(resolveShowLocation("", "city", "santa monica").error);
    assert.ok(resolveShowLocation("bogus", "city", "Santa Monica").error);
    assert.deepEqual(resolveShowLocation("", "manual", "Unlisted place"), { location: "Unlisted place", location_data: null });
    assert.deepEqual(resolveShowLocation("", "city", "AMV 26 / NYC", { location: "AMV 26 / NYC" }), { location: "AMV 26 / NYC", location_data: null });
    const city = searchShowCities("san mo")[0];
    const input = validateContentInput("show", "editor", { title: "Show", location: city.display_name, studio_site: "Santa Monica Beach", status: "draft" });
    assert.equal(input.payload.studio_site, "Santa Monica Beach");
    assert.equal(input.payload.location, city.display_name);
  });
  it("retains staffing, links, status and places personnel immediately before links", async () => {
    const editor = await readFile(new URL("../src/components/content-editor.tsx", import.meta.url), "utf8");
    assert.match(editor, /<ShowPersonnelEditor[\s\S]*?<AdditionalLinksEditor/);
    assert.match(editor, /name="status"/);
    const config = await readFile(new URL("../src/lib/content.ts", import.meta.url), "utf8");
    assert.match(config, /label: "Staffing Calendar"/);
    assert.match(config, /label: "Studio \/ Site"/);
  });
});
