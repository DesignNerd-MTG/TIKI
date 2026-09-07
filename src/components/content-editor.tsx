"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, PencilLine, Save } from "lucide-react";

import { archiveContentAction, deleteContentAction, fileNapkinAction, saveContentAction, type ContentActionState } from "@/app/(portal)/content-actions";
import { contentConfigs, filingDestinationKinds, getStatusLabel } from "@/lib/content";
import type { EntityKind, ManagedRecord } from "@/lib/types";

function SubmitButton({ create, label }: { create: boolean; label?: string }) {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : <><Save size={16} /> {label ?? (create ? "Create" : "Save changes")}</>}</button>;
}

function FileButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? "Filing…" : "Approve & File"}</button>;
}

export function EditButton() {
  function moveToEditor() {
    const editor = document.getElementById("edit-record");
    if (!editor) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    editor.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    const firstField = editor.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>("input:not([type='hidden']), textarea, select");
    window.setTimeout(() => firstField?.focus({ preventScroll: true }), reducedMotion ? 0 : 300);
  }

  return <button className="secondary-button" type="button" onClick={moveToEditor}><PencilLine size={15} /> Edit</button>;
}

export function ContentEditor({
  kind,
  record,
  tags = [],
  statuses,
  defaultStatus,
  adminCanPublishWithoutRevision = false,
}: {
  kind: EntityKind;
  record?: ManagedRecord | null;
  tags?: string[];
  statuses: string[];
  defaultStatus?: string;
  adminCanPublishWithoutRevision?: boolean;
}) {
  const config = contentConfigs[kind];
  const showStatusControl = kind !== "napkin" || Boolean(record && statuses.length > 1);
  const displayStatuses = kind === "napkin" && record?.status !== "converted" ? statuses.filter((status) => status !== "converted") : statuses;
  const router = useRouter();
  const [state, action] = useActionState(saveContentAction, { ok: false, message: "" } satisfies ContentActionState);
  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
    else if (state.ok) router.refresh();
  }, [router, state]);

  return (
    <form action={action} className="content-form" noValidate>
      <input type="hidden" name="_entity_kind" value={kind} />
      {record && <input type="hidden" name="id" value={record.id} />}
      {state.message && <div className={`notice ${state.ok ? "notice--success" : "notice--error"}`} role="status">{state.message}</div>}
      <div className="content-form__grid">
        {config.fields.map((field, index) => {
          const error = state.fieldErrors?.[field.name];
          const value = record?.[field.name];
          const className = field.wide ? "form-field form-field--wide" : "form-field";
          return (
            <label className={className} key={field.name}>
              <span>{field.label}{field.required && <em> required</em>}</span>
              {field.type === "textarea" ? (
                <textarea name={field.name} defaultValue={typeof value === "string" ? value : ""} maxLength={field.maxLength} rows={field.name === "body" ? 7 : 4} aria-invalid={Boolean(error)} autoFocus={!record && index === 0} />
              ) : field.type === "select" ? (
                <select name={field.name} defaultValue={typeof value === "string" ? value : field.options?.[0]?.value} aria-invalid={Boolean(error)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
              ) : field.type === "checkbox" ? (
                <span className="check-control"><input name={field.name} type="checkbox" value="true" defaultChecked={value === true} /> Yes</span>
              ) : (
                <input name={field.name} type={field.type} defaultValue={typeof value === "string" || typeof value === "number" ? String(value) : ""} required={field.required} maxLength={field.maxLength} placeholder={field.placeholder} aria-invalid={Boolean(error)} autoFocus={!record && index === 0} />
              )}
              {field.help && <small>{field.help}</small>}
              {error && <small className="field-error">{error}</small>}
            </label>
          );
        })}

        {showStatusControl ? (
          <label className="form-field">
            <span>{kind === "napkin" ? "Workflow" : "Status"}</span>
            <select name="status" defaultValue={String(record?.status ?? defaultStatus ?? displayStatuses[0])} aria-invalid={Boolean(state.fieldErrors?.status)}>
              {displayStatuses.map((status) => <option value={status} key={status}>{getStatusLabel(status)}</option>)}
            </select>
            {kind === "napkin" && <small>{record?.status === "converted" ? "This Napkin is linked to its filed record." : "Use Approve & File below to create the destination record."}</small>}
            {state.fieldErrors?.status && <small className="field-error">{state.fieldErrors.status}</small>}
          </label>
        ) : (
          <input type="hidden" name="status" value={String(record?.status ?? "raw")} />
        )}

        <label className="form-field form-field--wide">
          <span>Tags</span>
          <input name="tags" defaultValue={tags.join(", ")} placeholder="lighting, broadcast, console" aria-invalid={Boolean(state.fieldErrors?.tags)} />
          <small>Comma-separated, up to 12 tags.</small>
          {state.fieldErrors?.tags && <small className="field-error">{state.fieldErrors.tags}</small>}
        </label>
        {!(kind === "napkin" && !record) && <label className="form-field form-field--wide">
          <span>Revision note</span>
          <textarea name="revision_note" rows={2} maxLength={500} placeholder={record ? "What changed, and why?" : "Optional source or context for the first revision"} aria-invalid={Boolean(state.fieldErrors?.revision_note)} />
          <small>{!record ? "Optional context for the audit trail." : adminCanPublishWithoutRevision ? "Optional when publishing as an administrator; other status changes require a note." : "Status changes require a revision note."}</small>
          {state.fieldErrors?.revision_note && <small className="field-error">{state.fieldErrors.revision_note}</small>}
        </label>}
      </div>
      <div className="content-form__actions"><SubmitButton create={!record} label={kind === "napkin" && !record ? "Store Napkin" : undefined} /></div>
    </form>
  );
}

export function FileNapkinControl({ id, suggestedTitle, hasSourceUrl }: { id: string; suggestedTitle: string; hasSourceUrl: boolean }) {
  const router = useRouter();
  const [state, action] = useActionState(fileNapkinAction, { ok: false, message: "" } satisfies ContentActionState);
  useEffect(() => {
    if (state.ok && state.redirectTo) router.push(state.redirectTo);
  }, [router, state]);

  return (
    <section className="panel editor-panel napkin-file-panel">
      <div className="panel__heading"><div><p className="eyebrow">Editorial approval</p><h2>Approve and file this Napkin</h2></div></div>
      <p className="form-intro">This creates a published record in the selected section, copies the Napkin’s tags and source, and marks the original as Filed.</p>
      <form action={action} className="content-form">
        <input type="hidden" name="id" value={id} />
        {state.message && <div className={`notice ${state.ok ? "notice--success" : "notice--error"}`} role="status">{state.message}</div>}
        <div className="content-form__grid">
          <label className="form-field"><span>File into</span><select name="target_kind" defaultValue="" aria-invalid={Boolean(state.fieldErrors?.target_kind)}><option value="">Choose a section</option>{filingDestinationKinds.map((kind) => <option value={kind} key={kind}>{contentConfigs[kind].plural}</option>)}</select>{state.fieldErrors?.target_kind && <small className="field-error">{state.fieldErrors.target_kind}</small>}</label>
          <label className="form-field"><span>Record title</span><input name="record_title" defaultValue={suggestedTitle} maxLength={160} aria-invalid={Boolean(state.fieldErrors?.record_title)} />{state.fieldErrors?.record_title && <small className="field-error">{state.fieldErrors.record_title}</small>}</label>
          <label className="form-field form-field--wide"><span>Approval note</span><textarea name="review_note" rows={2} maxLength={500} placeholder="Why this belongs in the knowledge base" aria-invalid={Boolean(state.fieldErrors?.review_note)} /><small>{hasSourceUrl ? "The source link will be copied to the filed record." : "Links and Documents require a Source URL before filing."}</small>{state.fieldErrors?.review_note && <small className="field-error">{state.fieldErrors.review_note}</small>}</label>
        </div>
        <div className="content-form__actions"><FileButton /></div>
      </form>
    </section>
  );
}

export function ArchiveButton({ kind, id }: { kind: EntityKind; id: string }) {
  const [state, action] = useActionState(archiveContentAction, { ok: false, message: "" } satisfies ContentActionState);
  return <div className="mutation-control"><form action={action}><input type="hidden" name="_entity_kind" value={kind} /><input type="hidden" name="id" value={id} /><button className="secondary-button" type="submit"><Archive size={15} /> Archive</button></form>{state.message && <span className={state.ok ? "inline-success" : "field-error"} role="status">{state.message}</span>}</div>;
}

export function DeleteButton({ kind, id, label }: { kind: EntityKind; id: string; label: string }) {
  const [state, action] = useActionState(deleteContentAction, { ok: false, message: "" } satisfies ContentActionState);
  return <div className="mutation-control"><form action={action} onSubmit={(event) => { if (!window.confirm(`Permanently delete “${label}”? This cannot be undone.`)) event.preventDefault(); }}><input type="hidden" name="_entity_kind" value={kind} /><input type="hidden" name="id" value={id} /><button className="danger-button" type="submit">Delete permanently</button></form>{state.message && <span className="field-error" role="status">{state.message}</span>}</div>;
}
