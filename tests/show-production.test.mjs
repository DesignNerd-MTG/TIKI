import assert from "node:assert/strict";
import { it } from "node:test";
import { validateShowStops, isGooglePhotosUrl } from "../src/lib/show-production.ts";
import { validateContentInput } from "../src/lib/content-validation.ts";

it("validates photo links without accepting uploads, other hosts or credentials", () => {
  for (const url of ["", "https://photos.app.goo.gl/album", "https://photos.google.com/share/album"]) assert.equal(isGooglePhotosUrl(url), true);
  for (const url of ["https://example.com/", "https://photos.google.com.evil.com/", "http://photos.google.com/", "https://user:pass@photos.google.com/", "javascript:alert(1)"]) assert.equal(isGooglePhotosUrl(url), false);
  assert.equal(validateContentInput("show", "admin", { title: "History", producer: "Producer", network_brand: "Brand", google_photos_url: "photos.app.goo.gl/album", summary: "Memory", status: "published" }).valid, true);
  assert.equal(validateContentInput("show", "admin", { title: "History", google_photos_url: "https://example.com", status: "published" }).valid, false);
});
it("preserves ordered return visits and rejects missing locations or invalid dates", () => {
  const stop = { location_id: crypto.randomUUID(), start_date: "2024-02-29", end_date: "2024-03-01" };
  assert.deepEqual(validateShowStops(JSON.stringify([stop, stop])).stops, [stop, stop]);
  assert.deepEqual(validateShowStops("[]"), { stops: [] });
  for (const value of ["null", "{}", "bad", JSON.stringify([{ ...stop, location_id: "" }]), JSON.stringify([{ ...stop, start_date: "2025-02-29" }]), JSON.stringify([{ ...stop, end_date: "2023-01-01" }]), JSON.stringify(Array(101).fill(stop))]) assert.ok(validateShowStops(value).error);
});
