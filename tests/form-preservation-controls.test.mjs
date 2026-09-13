import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

import { readAdditionalLinks } from "../src/lib/additional-links.ts";
import { isSafeExternalUrl, normalizeExternalUrl, validateContentInput } from "../src/lib/content-validation.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const reference = (overrides = {}) => ({
  url: "", label: "Useful reference", collection_id: "unsorted", subcollection_id: "", date_added: "",
  description: "Long notes stay here", status: "draft", tags: "lighting, field", revision_note: "", ...overrides,
});

describe("form failure preservation and URL normalization", () => {
  it("normalizes common human domains before the existing HTTP safety check", () => {
    assert.equal(normalizeExternalUrl("footcandle.com"), "https://footcandle.com");
    assert.equal(normalizeExternalUrl(" www.footcandle.com "), "https://www.footcandle.com");
    assert.equal(normalizeExternalUrl("https://footcandle.com/path"), "https://footcandle.com/path");
    assert.equal(normalizeExternalUrl("http://footcandle.com"), "http://footcandle.com");
    for (const value of ["javascript:alert(1)", "not a domain", "//example.com", "https://user:secret@example.com"]) {
      assert.equal(isSafeExternalUrl(normalizeExternalUrl(value)), false);
    }
  });

  it("accepts bare, complete, URL-less, and title-only References as intended", () => {
    for (const url of ["footcandle.com", "www.footcandle.com", "https://footcandle.com", "http://footcandle.com"]) {
      const result = validateContentInput("link", "contributor", reference({ url, label: "" }));
      assert.equal(result.valid, true);
      if (result.valid) assert.equal(result.payload.url, normalizeExternalUrl(url));
    }
    assert.equal(validateContentInput("link", "contributor", reference({ url: "", label: "Title only" })).valid, true);
    assert.equal(validateContentInput("link", "contributor", reference({ url: "", label: "", description: "Notes without a URL" })).valid, false);
  });

  it("allows a second submit after one unrelated field is corrected", () => {
    const first = reference({ url: "footcandle.com", collection_id: "control-systems", subcollection_id: "consoles", tags: Array.from({ length: 13 }, (_, index) => `tag${index}`).join(",") });
    const failed = validateContentInput("link", "contributor", first);
    assert.equal(failed.valid, false);
    if (!failed.valid) assert.match(failed.fieldErrors.tags, /12 tags/);
    const corrected = validateContentInput("link", "contributor", { ...first, tags: "lighting" });
    assert.equal(corrected.valid, true);
    if (corrected.valid) {
      assert.equal(corrected.payload.url, "https://footcandle.com");
      assert.equal(corrected.payload.collection_id, "control-systems");
      assert.equal(corrected.payload.subcollection_id, "consoles");
    }
  });

  it("normalizes and retains submitted additional-link rows even when invalid", () => {
    const form = new FormData();
    form.append("additional_link_section", "fixture");
    form.append("additional_link_label", "");
    form.append("additional_link_url", "footcandle.com");
    const result = readAdditionalLinks(form, "fixture");
    assert.equal(result.valid, false);
    assert.equal(result.links[0].url, "https://footcandle.com");
  });

  it("echoes every ContentEditor value and focuses the first invalid field", async () => {
    const [action, editor] = await Promise.all([read("src/app/(portal)/content-actions.ts"), read("src/components/content-editor.tsx")]);
    assert.match(action, /values: input, additionalLinks: additionalLinks\.links, submissionKey/);
    assert.match(action, /input\[field\.name\] = field\.type === "checkbox"/);
    assert.match(editor, /submitted \? state\.values\?\.\[field\.name\]/);
    assert.match(editor, /value=\{collection\}/);
    assert.match(editor, /value=\{subcollection\}/);
    assert.match(editor, /initialValues\.collection_id/);
    assert.match(editor, /initialValues\.subcollection_id/);
    assert.match(editor, /state\.values\?\.tags/);
    assert.match(editor, /state\.values\?\.revision_note/);
    assert.match(editor, /state\.additionalLinks \?\? additionalLinks/);
    assert.match(editor, /scrollIntoView/);
    assert.match(editor, /\.focus\(\{ preventScroll: true \}\)/);
  });

  it("themes shared selects and keeps the mobile Reference sort compact", async () => {
    const [css, hub] = await Promise.all([read("src/app/globals.css"), read("src/components/reference-hub.tsx")]);
    assert.match(css, /select\s*{[\s\S]*?background-color: var\(--control-fill\);[\s\S]*?color: var\(--text-primary\);/);
    assert.match(css, /select option\s*{[\s\S]*?background-color: var\(--surface-raised\)/);
    assert.match(css, /select:disabled\s*{[\s\S]*?background-color: var\(--surface-muted\)/);
    assert.match(css, /\.compact-select-control select\s*{[\s\S]*?border-radius/);
    assert.match(css, /@media \(max-width: 560px\)[\s\S]*?\.reference-sort-control\s*{[\s\S]*?grid-template-columns: minmax\(0, 1fr\) auto/);
    assert.match(hub, /className="compact-select-control"/);
    assert.match(hub, /aria-label="Sort references"/);
  });
});
