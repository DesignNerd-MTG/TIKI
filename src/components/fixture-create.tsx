"use client";

import { useState, useTransition } from "react";
import { ContentEditor } from "@/components/content-editor";
import { reviewGdtfAction } from "@/app/(portal)/fixtures/new/gdtf-action";
import { gdtfPrefill, resolveGdtfManufacturer, selectedGdtfMode, type GdtfReview } from "@/lib/gdtf-review";
import type { FixtureManufacturer } from "@/lib/fixture-manufacturers";

export function FixtureCreate({ statuses, defaultStatus, manufacturers, canAddManufacturer }: {
  statuses: string[]; defaultStatus?: string; manufacturers: FixtureManufacturer[]; canAddManufacturer: boolean;
}) {
  const [path, setPath] = useState<"manual" | "import">("manual");
  const [review, setReview] = useState<GdtfReview | null>(null);
  const [selection, setSelection] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const editorProps = { statuses, defaultStatus, manufacturers, canAddManufacturer };
  const resolved = review ? resolveGdtfManufacturer(review.manufacturer, manufacturers) : null;
  const mode = review ? selectedGdtfMode(review.modes, selection) : null;

  function choosePath(next: "manual" | "import") {
    if (path === next) return;
    if ((path === "manual" || editing) && !window.confirm("Switch creation path? Unsaved form edits will be discarded.")) return;
    setPath(next); setReview(null); setEditing(false); setSelection(""); setError("");
  }

  return <div className="page-stack">
    <div className="page-actions" aria-label="Fixture creation paths">
      <button type="button" className={path === "manual" ? "primary-button" : "secondary-button"} aria-pressed={path === "manual"} disabled={pending} onClick={() => choosePath("manual")}>Add Manually</button>
      <button type="button" className={path === "import" ? "primary-button" : "secondary-button"} aria-pressed={path === "import"} disabled={pending} onClick={() => choosePath("import")}>Import GDTF</button>
    </div>
    {path === "manual" ? <ContentEditor kind="fixture" {...editorProps} /> : <>
      {!editing && <form className="content-form" action={(form) => {
        setError(""); setReview(null); setSelection("");
        startTransition(async () => {
          try {
            const result = await reviewGdtfAction(form);
            setReview(result.review ?? null); setError(result.error ?? "");
          } catch { setError("Upload could not be completed. Check the 2 MB limit and your sign-in, or use Add Manually."); }
        });
      }}>
        <label className="form-field"><span>GDTF file</span><input name="gdtf" type="file" accept=".gdtf" required disabled={pending} onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.setCustomValidity(file && file.size > 2 * 1024 * 1024 ? "Choose a file no larger than 2 MB." : "");
        }} /><small>Maximum 2 MB. The file is inspected in memory, not stored. Nothing creates a Fixture until you review and click Create.</small></label>
        <button className="secondary-button" type="submit" disabled={pending}>{pending ? "Inspecting…" : "Review imported data"}</button>
      </form>}
      {error && <div className="notice notice--error" role="alert">{error}</div>}
      {review && <section className="page-stack" aria-label="Review imported data">
        <div><p className="eyebrow">Imported values — not saved</p><h2>Review Imported Data</h2></div>
        {!editing && <>
          <dl className="detail-definition-list">
            <div><dt>Fixture name</dt><dd>{review.name || "Not supplied"}</dd></div>
            <div><dt>Manufacturer from file</dt><dd>{review.manufacturer || "Not supplied"}</dd></div>
            <div><dt>Resolution</dt><dd>{resolved ? `Matched: ${resolved.name} — confirm in the form.` : "Manufacturer not currently in T.I.K.I. or ambiguous. Choose a canonical manufacturer in the review form. Editors/Admins may explicitly add a new brand."}</dd></div>
            <div><dt>Description → Field notes</dt><dd>{review.description || "Not supplied"}</dd></div>
            <div><dt>Weight</dt><dd>{review.weightLb === null ? "Not supplied" : `${review.weightLb} lb (converted from kg; editable)`}</dd></div>
          </dl>
          <label className="form-field"><span>Choose Preferred Mode</span><select value={selection} onChange={(event) => setSelection(event.target.value)}>
            <option value="">Choose explicitly — no default mode</option>
            {review.modes.map((item, index) => <option key={index} value={String(index)}>{item.name || `Unnamed mode ${index + 1}`} — {item.footprint === null ? "footprint needs verification" : `${item.footprint} channels`}</option>)}
            <option value="manual">Enter mode manually / leave unspecified</option>
          </select></label>
          {mode?.warning && <div className="notice notice--warning">{mode.warning}</div>}
          <button type="button" className="primary-button" disabled={!selection} onClick={() => setEditing(true)}>Confirm mode choice & edit fields</button>
        </>}
        <div className="notice notice--neutral"><ul>{review.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div>
        {editing && <>
          <p className="form-intro">Review every prefilled field below. Your mode choice is confirmed, but remains editable. Choose fixture type and resolve the manufacturer before creating. To inspect another file, switch creation paths; unsaved edits will be discarded.</p>
          {mode?.warning && <div className="notice notice--warning">{mode.warning}</div>}
          <ContentEditor kind="fixture" {...editorProps} initialValues={gdtfPrefill(review, manufacturers, selection)} />
        </>}
      </section>}
    </>}
  </div>;
}
