import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

import { validateContentInput } from "../src/lib/content-validation.ts";
import { normalizeNapkinSketch, napkinSketchPath } from "../src/lib/napkin-sketch.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const napkinInput = (body, hasSketch) => ({ body, source_url: "", urgent: false, status: "raw", tags: "", revision_note: "", _has_sketch: String(hasSketch) });

describe("corrective palette, Napkin sketch, and release behavior", () => {
  it("accepts text-only and sketch-only Napkins but rejects an empty capture", () => {
    assert.equal(validateContentInput("napkin", "viewer", napkinInput("Remember this", false)).valid, true);
    const sketchOnly = validateContentInput("napkin", "viewer", napkinInput("", true));
    assert.equal(sketchOnly.valid, true);
    if (sketchOnly.valid) assert.equal(sketchOnly.payload.body, "");
    const empty = validateContentInput("napkin", "viewer", napkinInput("", false));
    assert.equal(empty.valid, false);
    if (!empty.valid) assert.match(empty.fieldErrors.body, /text or draw a sketch/i);
  });

  it("normalizes stored sketches as bounded opaque PNGs with canonical paths", async () => {
    const source = await sharp({ create: { width: 12, height: 8, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.25 } } }).png().toBuffer();
    const output = await normalizeNapkinSketch(source, "image/png");
    const metadata = await sharp(output).metadata();
    assert.equal(metadata.format, "png");
    assert.equal(metadata.hasAlpha, false);
    assert.equal(napkinSketchPath("owner", "note"), "owner/note.png");
    await assert.rejects(() => normalizeNapkinSketch(source, "image/jpeg"), /must be a PNG/);
  });

  it("wires three admin-managed site palette slots, six editable tokens, preview, and fallback", async () => {
    const [component, action, admin, account, layout] = await Promise.all([
      read("src/components/custom-palettes.tsx"),
      read("src/app/(portal)/admin/palette-actions.ts"),
      read("src/app/(portal)/admin/page.tsx"),
      read("src/app/(portal)/account/page.tsx"),
      read("src/app/(portal)/layout.tsx"),
    ]);
    assert.match(component, /\[1,\s*2,\s*3\]/);
    for (const command of ["save", "reset", "activate"]) assert.match(component, new RegExp(`value=\\"${command}\\"`));
    for (const token of ["canvas", "surface", "primary_accent", "secondary_accent", "primary_text", "muted_text"]) assert.match(component, new RegExp(token));
    assert.match(component, /live preview/);
    assert.match(component, /paletteWarnings/);
    assert.match(action, /requireActiveProfile\("admin"\)/);
    assert.match(action, /site_custom_palettes/);
    assert.match(action, /active_custom_slot: null/);
    assert.match(admin, /<CustomPalettes/);
    assert.doesNotMatch(account, /CustomPalettes|user_appearance/);
    assert.match(layout, /data-custom-palette/);
    assert.doesNotMatch(layout, /user_appearance|user_custom_palettes/);
  });

  it("keeps the Napkin capture compact and orders Link, embedded sketch, Store, then export", async () => {
    const [editor, content, css] = await Promise.all([read("src/components/content-editor.tsx"), read("src/lib/content.ts"), read("src/app/globals.css")]);
    assert.match(editor, /fieldLabel = kind === "napkin"[\s\S]*?"Link"/);
    assert.match(editor, /Optional — add a related link\./);
    assert.match(editor, /<SketchPad[^>]*embedded[^>]*inputName="sketch"/);
    assert.match(editor, /Store Napkin[\s\S]*Save sketch to device/);
    assert.match(editor, /rows={field\.name === "body" \? 6 : 4}/);
    assert.match(content, /name: "source_url", label: "Source URL"/);
    assert.match(css, /\.sketch-pad--embedded canvas/);
    assert.match(css, /\.napkin-capture-actions/);
  });

  it("uploads the sketch with the Napkin while later text edits and filing preserve its path", async () => {
    const [action, detail, migration] = await Promise.all([
      read("src/app/(portal)/content-actions.ts"),
      read("src/components/content-pages.tsx"),
      read("supabase/migrations/202609140018_napkin_sketches.sql"),
    ]);
    assert.match(action, /storage\.from\(napkinSketchBucket\)\.upload/);
    assert.match(action, /payload\.sketch_path = uploadedSketchPath/);
    assert.match(action, /if \(uploadedSketchPath\).*remove/s);
    assert.match(detail, /<NapkinSketch/);
    assert.match(migration, /char_length\(btrim\(body\)\) > 0 or sketch_path is not null/i);
    assert.doesNotMatch(action, /existing[\s\S]{0,100}payload\.sketch_path/);
  });

  it("bumps package and lock metadata together to v0.2.0", async () => {
    const [manifest, lock] = await Promise.all([read("package.json"), read("package-lock.json")]);
    assert.equal(JSON.parse(manifest).version, "0.2.0");
    const parsed = JSON.parse(lock);
    assert.equal(parsed.version, "0.2.0");
    assert.equal(parsed.packages[""].version, "0.2.0");
  });

  it("keeps Sketch available without a persistent sidebar shortcut", async () => {
    const [shell, dashboard, route] = await Promise.all([
      read("src/components/app-shell.tsx"),
      read("src/components/dashboard-view.tsx"),
      read("src/app/(portal)/sketch/page.tsx"),
    ]);
    assert.doesNotMatch(shell, /href="\/sketch"/);
    assert.match(shell, /T\.I\.K\.I\. v\{version\}/);
    assert.match(dashboard, /href="\/sketch"/);
    assert.match(route, /<SketchPad/);
  });
});
