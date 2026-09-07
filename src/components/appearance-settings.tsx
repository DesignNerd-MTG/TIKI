"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Palette } from "lucide-react";

import { updateAppearanceAction, type AppearanceActionState } from "@/app/(portal)/admin/appearance-actions";
import { themePresets, type ThemePreset } from "@/lib/theme";

export function AppearanceSettings({ currentTheme }: { currentTheme: ThemePreset }) {
  const router = useRouter();
  const [selected, setSelected] = useState<ThemePreset>(currentTheme);
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
      <p className="appearance-panel__intro">Choose a curated, contrast-tested atmosphere for every active T.I.K.I. user. The dark navigation stays familiar.</p>
      {state.message && <div className={`notice ${state.ok ? "notice--success" : "notice--error"}`} role="status">{state.ok && <Check size={17} />}{state.message}</div>}
      <form action={action}>
        <div className="theme-options" role="radiogroup" aria-label="T.I.K.I. theme">
          {themePresets.map((preset) => (
            <label className={`theme-option ${selected === preset.id ? "theme-option--selected" : ""}`} key={preset.id}>
              <input type="radio" name="theme" value={preset.id} checked={selected === preset.id} onChange={() => setSelected(preset.id)} />
              <span className="theme-option__swatches" aria-hidden="true">
                {preset.swatches.map((color) => <i style={{ backgroundColor: color }} key={color} />)}
              </span>
              <span className="theme-option__copy"><strong>{preset.label}</strong><small>{preset.description}</small></span>
            </label>
          ))}
        </div>
        <div className="theme-live-preview" data-theme={selected} aria-label={`${themePresets.find((preset) => preset.id === selected)?.label} preview`}>
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
