"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette } from "lucide-react";

import { updateSitePaletteAction, type PaletteActionState } from "@/app/(portal)/admin/palette-actions";
import { customPaletteDefaults, customPaletteStyle, paletteWarnings, validPaletteTokens, type CustomPalette, type CustomPaletteTokens } from "@/lib/theme";

const labels: Record<keyof CustomPaletteTokens, string> = {
  canvas: "Canvas / Background",
  surface: "Surface / Panel",
  primary_accent: "Primary Accent",
  secondary_accent: "Secondary Accent",
  primary_text: "Primary Text",
  muted_text: "Muted Text",
};

export function CustomPalettes({ saved, activeSlot }: { saved: CustomPalette[]; activeSlot: number | null }) {
  const router = useRouter();
  const [state, action] = useActionState(updateSitePaletteAction, { ok: false, message: "" } satisfies PaletteActionState);
  const [palettes, setPalettes] = useState<CustomPalette[]>(() => [1,2,3].map((slot) => saved.find((palette) => palette.slot === slot) ?? { slot, name: `Custom Palette ${slot}`, tokens: { ...customPaletteDefaults } }));

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state.ok, router]);

  const update = (slot: number, field: string, value: string) => setPalettes((current) => current.map((palette) => palette.slot !== slot
    ? palette
    : field === "name"
      ? { ...palette, name: value }
      : { ...palette, tokens: { ...palette.tokens, [field]: value } }));

  return (
    <section className="panel custom-palettes" aria-labelledby="custom-palettes-heading">
      <div className="panel__heading">
        <div><p className="eyebrow">Admin-managed additions</p><h2 id="custom-palettes-heading"><Palette size={19} /> Custom palettes</h2></div>
      </div>
      <p className="appearance-panel__intro">These three saved slots extend the curated Appearance choices for everyone in T.I.K.I. Unsaved preview changes stay in this editor.</p>
      {state.message && <div className={`notice ${state.ok ? "notice--success" : "notice--error"}`} role="status">{state.ok && <Check size={17} />}{state.message}</div>}
      <div className="custom-palette-grid">
        {palettes.map((palette) => {
          const isSaved = saved.some((row) => row.slot === palette.slot);
          const isActive = activeSlot === palette.slot;
          const validTokens = validPaletteTokens(palette.tokens);
          const warnings = validTokens ? paletteWarnings(palette.tokens) : ["Every token needs a six-digit hex color before saving."];
          return (
            <form action={action} className={`custom-palette ${isActive ? "custom-palette--active" : ""}`} key={palette.slot} aria-labelledby={`palette-${palette.slot}-heading`}>
              <input type="hidden" name="slot" value={palette.slot} />
              <div className="custom-palette__heading"><strong id={`palette-${palette.slot}-heading`}>{isActive ? "Active palette" : `Slot ${palette.slot}`}</strong><span>{isSaved ? "Saved" : "Not saved"}</span></div>
              <label className="form-field"><span>Palette name</span><input name="name" value={palette.name} maxLength={40} onChange={(event) => update(palette.slot, "name", event.target.value)} /></label>
              <div className="palette-token-grid">
                {Object.entries(labels).map(([key, label]) => {
                  const token = key as keyof CustomPaletteTokens;
                  const value = palette.tokens[token];
                  const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#000000";
                  return <label key={key}><span>{label}</span><span className="palette-token-control"><input aria-label={`${label} color`} type="color" value={colorValue} onChange={(event) => update(palette.slot, key, event.target.value)} /><input aria-label={`${label} hex value`} name={key} value={value} maxLength={7} pattern="#[0-9A-Fa-f]{6}" spellCheck={false} onChange={(event) => update(palette.slot, key, event.target.value)} /></span></label>;
                })}
              </div>
              <div className="palette-sample" style={customPaletteStyle(palette.tokens)} aria-label={`${palette.name || `Custom Palette ${palette.slot}`} live preview`}>
                <strong>Readable field notes</strong><span>Muted supporting text</span><button type="button">Action</button>
              </div>
              {warnings.length > 0 && <div className="notice notice--warning" role="status">{warnings.map((warning) => <span key={warning}>{warning}</span>)}</div>}
              <div className="page-actions">
                <button className="primary-button" name="command" value="save" type="submit">Save Palette</button>
                <button className="secondary-button" name="command" value="activate" type="submit" disabled={!isSaved || isActive}>{isActive ? "Active site-wide" : "Use site-wide"}</button>
                <button className="secondary-button" name="command" value="reset" type="submit">Reset Palette</button>
              </div>
            </form>
          );
        })}
      </div>
    </section>
  );
}
