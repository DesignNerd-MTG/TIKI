import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  defaultTheme,
  isThemePreset,
  resolveTheme,
  themePresets,
} from "../src/lib/theme.ts";

function luminance(hex) {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)
    .map((channel) => Number.parseInt(channel, 16) / 255)
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function contrastRatio(first, second) {
  const lighter = Math.max(luminance(first), luminance(second));
  const darker = Math.min(luminance(first), luminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

describe("portal appearance presets", () => {
  it("falls back to the darker T.I.K.I. default", () => {
    assert.equal(defaultTheme, "volcanic-sand");
    assert.equal(resolveTheme("lagoon"), "lagoon");
    assert.equal(resolveTheme("not-a-theme"), defaultTheme);
    assert.equal(resolveTheme(undefined), defaultTheme);
    assert.equal(isThemePreset("night"), true);
    assert.equal(isThemePreset("custom-css"), false);
    assert.deepEqual(themePresets[0].swatches, ["#2b211b", "#5a4030", "#f06b3d", "#43b8c4"]);
    assert.equal(themePresets[0].sidebar, "#18120f");
  });

  it("keeps text readable on every theme canvas", () => {
    for (const preset of themePresets) {
      const [canvas] = preset.swatches;
      assert.ok(
        contrastRatio(canvas, preset.text) >= 4.5,
        `${preset.label} must meet WCAG AA canvas contrast`,
      );
      assert.ok(
        contrastRatio(preset.control, preset.text) >= 4.5,
        `${preset.label} must meet WCAG AA field contrast`,
      );
      assert.ok(
        contrastRatio(preset.sidebar, preset.sidebarText) >= 4.5,
        `${preset.label} must meet WCAG AA sidebar contrast`,
      );
      for (const swatch of preset.swatches) {
        assert.ok(
          luminance(swatch) < 0.62,
          `${preset.label} swatches should stay in the darker palette range`,
        );
      }
    }
  });

  it("ships semantic surfaces and contrasting field styles", async () => {
    const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
    assert.match(css, /--canvas:/);
    assert.match(css, /--surface-raised:/);
    assert.match(css, /--control-fill:/);
    assert.match(css, /\.form-field input:not\(\[type="checkbox"\]\)[\s\S]*background: var\(--control-fill\)/);
    assert.match(css, /\.theme-live-preview/);
    assert.match(css, /\[data-theme\][\s\S]*--slate: var\(--text-secondary\)/);
    assert.match(css, /--ambient-warm:/);
    assert.match(css, /\.workspace[\s\S]*radial-gradient[\s\S]*var\(--ambient-cool\)/);
    assert.match(css, /\[data-theme="night"\][^}]*--text-secondary: #ffffff/);
    assert.match(css, /\[data-theme="night"\][^}]*--text-muted: #ffffff/);
    assert.match(css, /\[data-theme="night"\][^}]*--sidebar-bg: #171021/);
    assert.match(css, /\.nav-link--active\s*{[^}]*background: var\(--sidebar-active\)/);
    assert.match(css, /\.nav-link--active::before\s*{[^}]*background: var\(--sidebar-accent\)/);
    assert.match(css, /\.brand__water\s*{[^}]*background: var\(--sidebar-accent\)/);
    assert.match(css, /\.dashboard-hero\s*{[\s\S]*var\(--hero-gradient-start\)[\s\S]*var\(--hero-gradient-end\)/);
    assert.match(css, /\.dashboard-hero__glow\s*{[^}]*background: var\(--hero-glow\)/);
    assert.match(css, /\.hero-kicker\s*{[^}]*color: var\(--hero-kicker\)/);
  });

  it("keeps the Napkin card and capture form inside the active theme", async () => {
    const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const card = css.match(/\.napkin-card\s*{([^}]*)}/)?.[1] ?? "";
    const capture = css.match(/\.napkin-capture\s*{([^}]*)}/)?.[1] ?? "";
    const fields = css.match(/\.napkin-form textarea,\s*\.napkin-form input\[type="url"\]\s*{([^}]*)}/)?.[1] ?? "";

    assert.match(card, /var\(--surface-raised\)/);
    assert.match(card, /var\(--napkin-accent-soft\)/);
    assert.match(capture, /var\(--surface-raised\)/);
    assert.match(capture, /var\(--napkin-line\)/);
    assert.match(fields, /background: var\(--control-fill\)/);
    assert.doesNotMatch(`${card}${capture}${fields}`, /#fffaf0|rgba\(242, 230, 191/);
  });

  it("keeps legacy light literals out of authenticated portal components", async () => {
    const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const portalCss = css.split("/* Portal shell */")[1] ?? "";

    assert.doesNotMatch(portalCss, /#fff9e9|#cfd8da|#cfe3df|#b8dcd7|#d6e9e5|#dcebe8/i);
    assert.doesNotMatch(portalCss, /#[0-9a-f]{3,8}|rgba?\(/i);
    assert.match(portalCss, /\.restricted-badge[\s\S]*var\(--warning-surface\)/);
    assert.match(portalCss, /\.answer-card[\s\S]*var\(--border\)/);
  });

  it("gives every palette its own dashboard hero treatment", async () => {
    const css = await readFile(new URL("../src/app/globals.css", import.meta.url), "utf8");
    const heroGradients = themePresets.map((preset) => {
      const block = css.match(new RegExp(`\\[data-theme="${preset.id}"\\]\\s*\\{([^}]*)\\}`))?.[1] ?? "";
      assert.match(block, /--hero-gradient-start:/, `${preset.label} needs a hero start color`);
      assert.match(block, /--hero-gradient-end:/, `${preset.label} needs a hero end color`);
      assert.match(block, /--hero-glow:/, `${preset.label} needs a hero glow`);
      return block.match(/--hero-gradient-end:\s*([^;]+)/)?.[1];
    });

    assert.equal(new Set(heroGradients).size, themePresets.length);
  });

  it("protects the global setting with authenticated read and admin update RLS", async () => {
    const migration = await readFile(
      new URL("../supabase/migrations/202609070002_site_appearance.sql", import.meta.url),
      "utf8",
    );
    assert.match(migration, /create table if not exists public\.site_settings/i);
    assert.match(migration, /enable row level security/i);
    assert.match(migration, /has_minimum_role\('viewer'\)/i);
    assert.match(migration, /has_minimum_role\('admin'\)/i);
    assert.doesNotMatch(migration, /service_role/i);
  });
});
