"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette } from "lucide-react";

import { updateAppearanceAction, type AppearanceActionState } from "@/app/(portal)/admin/appearance-actions";
import { customPaletteStyle, themePresets, type CustomPalette, type ThemePreset } from "@/lib/theme";

export function AppearanceSettings({ currentTheme, activeCustomSlot, palettes }: { currentTheme: ThemePreset; activeCustomSlot: number | null; palettes: CustomPalette[] }) {
  const router = useRouter();
  const initialSelection = activeCustomSlot ? `custom-${activeCustomSlot}` : currentTheme;
  const [selected, setSelected] = useState<string>(initialSelection);
  const [state, action] = useActionState(updateAppearanceAction, { ok: false, message: "" } satisfies AppearanceActionState);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [router, state.ok]);

  return (
    <section className="panel appearance-panel" aria-labelledby="appearance-heading">
      <div className="panel__heading">
        <div>
          <p className="eyebrow">Site-wide setting</p>
          <h2 id="appearance-heading"><Palette size={19} /> Appearance</h2>
        </div>
      </div>
      <p className="appearance-panel__intro">Choose a curated theme or one of the three saved custom slots for every active T.I.K.I. user.</p>
      {state.message && <div className={`notice ${state.ok ? "notice--success" : "notice--error"}`} role="status">{state.ok && <Check size={17} />}{state.message}</div>}
      <form action={action}>
        <input type="hidden" name="base_theme" value={currentTheme} />
        <div className="theme-options" role="radiogroup" aria-label="T.I.K.I. theme">
          {themePresets.map((preset) => (
            <label className={`theme-option ${selected === preset.id ? "theme-option--selected" : ""}`} key={preset.id}>
              <input type="radio" name="appearance" value={preset.id} checked={selected === preset.id} onChange={() => setSelected(preset.id)} />
              <span className="theme-option__swatches" aria-hidden="true">
                {preset.swatches.map((color) => <i style={{ backgroundColor: color }} key={color} />)}
              </span>
              <span className="theme-option__copy"><strong>{preset.label}</strong><small>{preset.description}</small></span>
            </label>
          ))}
          {[1,2,3].map((slot) => {
            const palette = palettes.find((item) => item.slot === slot);
            const value = `custom-${slot}`;
            return <label className={`theme-option ${selected === value ? "theme-option--selected" : ""}`} key={value}>
              <input type="radio" name="appearance" value={value} checked={selected === value} disabled={!palette} onChange={() => setSelected(value)} />
              <span className="theme-option__swatches" aria-hidden="true">{palette ? Object.values(palette.tokens).slice(0,4).map((color) => <i style={{ backgroundColor: color }} key={color} />) : <><i /><i /><i /><i /></>}</span>
              <span className="theme-option__copy"><strong>{palette?.name ?? `Custom Palette ${slot}`}</strong><small>{palette ? `Custom Palette ${slot}` : "Save this slot below to make it selectable."}</small></span>
            </label>;
          })}
        </div>
        <div className="theme-live-preview" data-theme={selected.startsWith("custom-") ? currentTheme : selected} style={customPaletteStyle(palettes.find((item) => `custom-${item.slot}` === selected)?.tokens)} aria-label={`${themePresets.find((preset) => preset.id === selected)?.label ?? palettes.find((item) => `custom-${item.slot}` === selected)?.name} preview`}>
          <div className="theme-live-preview__sidebar"><span /><span /><span /></div>
          <div className="theme-live-preview__canvas">
            <span className="theme-live-preview__heading" />
            <div><span /><span /></div>
          </div>
        </div>
        <div className="content-form__actions"><button className="primary-button" type="submit">Save appearance</button></div>
      </form>
    </section>
  );
}
