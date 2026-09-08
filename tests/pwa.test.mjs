import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

describe("installable T.I.K.I.", () => {
  it("ships a standalone manifest and low-risk service worker", async () => {
    const manifest = await readFile(new URL("../src/app/manifest.ts", import.meta.url), "utf8");
    const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
    const install = await readFile(new URL("../src/components/install-tiki.tsx", import.meta.url), "utf8");
    assert.match(manifest, /display: "standalone"/);
    assert.match(manifest, /start_url: "\/dashboard"/);
    assert.match(worker, /serviceWorker|fetch|skipWaiting/);
    assert.match(install, /beforeinstallprompt/);
    assert.match(install, /Add to Home Screen/);
    assert.match(install, /serviceWorker\.register\("\/sw\.js"\)/);
  });
});
