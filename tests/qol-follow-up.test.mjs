import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

describe("QOL follow-up interactions", () => {
  it("focuses global search for slash and Command/Ctrl K without stealing form input", async () => {
    const shell = await read("src/components/app-shell.tsx");
    assert.match(shell, /event\.key === "\/"/);
    assert.match(shell, /event\.key\.toLowerCase\(\) === "k"/);
    assert.match(shell, /event\.metaKey \|\| event\.ctrlKey/);
    assert.match(shell, /matches\("input, textarea, select"\)/);
    assert.match(shell, /isContentEditable/);
    assert.match(shell, /closest\("\[contenteditable='true'\]"\)/);
    assert.match(shell, /if \(!input \|\| input\.getClientRects\(\)\.length === 0\) return;[\s\S]*event\.preventDefault\(\);[\s\S]*input\.focus\(\)/);
  });

  it("shares the canonical path, falls back to clipboard, and reports feedback", async () => {
    const [share, pages, vendor] = await Promise.all([read("src/components/share-record.tsx"), read("src/components/content-pages.tsx"), read("src/app/(portal)/vendors/[id]/page.tsx")]);
    assert.match(share, /new URL\(pathname, window\.location\.origin\)\.href/);
    assert.match(share, /navigator\.share/);
    assert.match(share, /navigator\.clipboard\.writeText\(url\)/);
    assert.match(share, /report\("Copied"\)/);
    assert.match(pages, /<ShareRecord title=\{title\}/);
    assert.match(vendor, /<ShareRecord title=\{record\.name\}/);
  });

  it("carries canonical Reference context into editable initial defaults", async () => {
    const [hub, page, editor] = await Promise.all([read("src/components/reference-hub.tsx"), read("src/app/(portal)/links/new/page.tsx"), read("src/components/content-editor.tsx")]);
    assert.match(hub, /addReferenceParams\.set\("collection", selected\.id\)/);
    assert.match(hub, /addReferenceParams\.set\("subcollection", sub\.id\)/);
    assert.match(hub, /: "\/links\/new"/);
    assert.match(page, /referenceCollection\(params\.collection\)/);
    assert.match(page, /validCollectionPair/);
    assert.match(editor, /initialValues\.collection_id/);
    assert.match(editor, /onChange=\{\(event\) => \{ setCollection/);
  });

  it("keeps long-form submits in one safe-area-aware sticky action bar", async () => {
    const [editor, travel, vendor, css] = await Promise.all([read("src/components/content-editor.tsx"), read("src/components/travel-form.tsx"), read("src/components/vendor-editor.tsx"), read("src/app/globals.css")]);
    assert.match(editor, /\["fixture", "link", "napkin", "show"\]\.includes\(kind\)/);
    assert.match(travel, /content-form__actions--sticky/);
    assert.match(vendor, /content-form__actions--sticky/);
    assert.match(css, /\.content-form__actions--sticky\s*{[\s\S]*?position: sticky;[\s\S]*?env\(safe-area-inset-bottom\)/);
    assert.equal((editor.match(/<SubmitButton create=/g) ?? []).length, 1);
  });

  it("presents vendor primary actions, badge, and explicit empty state", async () => {
    const [editor, detail] = await Promise.all([read("src/components/vendor-editor.tsx"), read("src/app/(portal)/vendors/[id]/page.tsx")]);
    assert.match(editor, /secondary-button vendor-make-primary/);
    assert.match(editor, />Make Primary</);
    assert.match(editor, /primary-contact-badge/);
    assert.match(editor, /No primary contact selected\./);
    assert.match(detail, /No primary contact selected\./);
  });
});
