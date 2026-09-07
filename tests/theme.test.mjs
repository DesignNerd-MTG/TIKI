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
    assert.deepEqual(themePresets[0].swatches, ["#1f1b18", "#352e29", "#c9684f", "#1b1816"]);
  });

  it("keeps text readable on every theme canvas", () => {
    for (const preset of themePresets) {
      const [canvas, , , control] = preset.swatches;
      assert.ok(
        contrastRatio(canvas, preset.text) >= 4.5,
        `${preset.label} must meet WCAG AA canvas contrast`,
      );
      assert.ok(
        contrastRatio(control, preset.text) >= 4.5,
        `${preset.label} must meet WCAG AA field contrast`,
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
