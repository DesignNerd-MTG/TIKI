"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Archive, Save } from "lucide-react";

import { archiveContentAction, deleteContentAction, saveContentAction, type ContentActionState } from "@/app/(portal)/content-actions";
import { contentConfigs } from "@/lib/content";
import type { EntityKind, ManagedRecord, Profile } from "@/lib/types";

function SubmitButton({ create }: { create: boolean }) {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : <><Save size={16} /> {create ? "Create" : "Save changes"}</>}</button>;
}

export function ContentEditor({
  kind,
  record,
  tags = [],
  statuses,
  profiles = [],
}: {
  kind: EntityKind;
  record?: ManagedRecord | null;
  tags?: string[];
  statuses: string[];
  profiles?: Array<Pick<Profile, "id" | "email" | "full_name">>;
}) {
  const config = contentConfigs[kind];
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
        {config.fields.map((field) => {
          const error = state.fieldErrors?.[field.name];
          const value = record?.[field.name];
          const className = field.wide ? "form-field form-field--wide" : "form-field";
          return (
            <label className={className} key={field.name}>
              <span>{field.label}{field.required && <em> required</em>}</span>
              {field.type === "textarea" ? (
                <textarea name={field.name} defaultValue={typeof value === "string" ? value : ""} maxLength={field.maxLength} rows={field.name === "body" ? 7 : 4} aria-invalid={Boolean(error)} />
              ) : field.type === "select" ? (
                <select name={field.name} defaultValue={typeof value === "string" ? value : field.options?.[0]?.value} aria-invalid={Boolean(error)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>
              ) : field.type === "checkbox" ? (
                <span className="check-control"><input name={field.name} type="checkbox" value="true" defaultChecked={value === true} /> Yes</span>
              ) : (
                <input name={field.name} type={field.type} defaultValue={typeof value === "string" || typeof value === "number" ? String(value) : ""} required={field.required} maxLength={field.maxLength} placeholder={field.placeholder} aria-invalid={Boolean(error)} />
              )}
              {field.help && <small>{field.help}</small>}
              {error && <small className="field-error">{error}</small>}
            </label>
          );
        })}

        <label className="form-field">
          <span>Status</span>
          <select name="status" defaultValue={String(record?.status ?? statuses[0])} aria-invalid={Boolean(state.fieldErrors?.status)}>
            {statuses.map((status) => <option value={status} key={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          {state.fieldErrors?.status && <small className="field-error">{state.fieldErrors.status}</small>}
        </label>

        {kind === "napkin" && profiles.length > 0 && (
          <>
            <label className="form-field"><span>Assigned to</span><select name="assigned_to" defaultValue={String(record?.assigned_to ?? "")} aria-invalid={Boolean(state.fieldErrors?.assigned_to)}><option value="">Unassigned</option>{profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.full_name || profile.email}</option>)}</select>{state.fieldErrors?.assigned_to && <small className="field-error">{state.fieldErrors.assigned_to}</small>}</label>
            <label className="form-field"><span>Converted to</span><select name="converted_to_kind" defaultValue={String(record?.converted_to_kind ?? "")} aria-invalid={Boolean(state.fieldErrors?.converted_to_kind)}><option value="">Not converted</option>{Object.values(contentConfigs).filter((item) => item.kind !== "napkin").map((item) => <option value={item.kind} key={item.kind}>{item.singular}</option>)}</select>{state.fieldErrors?.converted_to_kind && <small className="field-error">{state.fieldErrors.converted_to_kind}</small>}</label>
            <label className="form-field form-field--wide"><span>Converted record ID</span><input name="converted_to_id" defaultValue={String(record?.converted_to_id ?? "")} placeholder="Optional UUID of the published record" aria-invalid={Boolean(state.fieldErrors?.converted_to_id)} />{state.fieldErrors?.converted_to_id && <small className="field-error">{state.fieldErrors.converted_to_id}</small>}</label>
          </>
        )}

        <label className="form-field form-field--wide">
          <span>Tags</span>
          <input name="tags" defaultValue={tags.join(", ")} placeholder="lighting, broadcast, console" aria-invalid={Boolean(state.fieldErrors?.tags)} />
          <small>Comma-separated, up to 12 tags.</small>
          {state.fieldErrors?.tags && <small className="field-error">{state.fieldErrors.tags}</small>}
        </label>
        <label className="form-field form-field--wide">
          <span>Revision note</span>
          <textarea name="revision_note" rows={2} maxLength={500} placeholder={record ? "What changed, and why?" : "Optional source or context for the first revision"} aria-invalid={Boolean(state.fieldErrors?.revision_note)} />
          <small>Status changes require a revision note.</small>
          {state.fieldErrors?.revision_note && <small className="field-error">{state.fieldErrors.revision_note}</small>}
        </label>
      </div>
      <div className="content-form__actions"><SubmitButton create={!record} /></div>
    </form>
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
