"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";

import { saveTravelAction, type TravelActionState } from "@/app/(portal)/travel/actions";

function TravelSaveButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : <><Save size={16} /> Save travel details</>}</button>;
}

export function TravelForm({ name, details, flightyUrl }: { name: string; details: string; flightyUrl: string }) {
  const [state, action] = useActionState(saveTravelAction, { ok: false, message: "" } satisfies TravelActionState);
  return (
    <form action={action} className="content-form" noValidate>
      {state.message && <div className={`notice ${state.ok ? "notice--success" : "notice--error"}`} role="status">{state.message}</div>}
      <div className="content-form__grid">
        <label className="form-field form-field--wide">
          <span>Name</span>
          <input name="name" type="text" defaultValue={name} maxLength={160} placeholder="Traveler name" aria-invalid={Boolean(state.fieldErrors?.name)} autoFocus />
          {state.fieldErrors?.name && <small className="field-error">{state.fieldErrors.name}</small>}
        </label>
        <label className="form-field form-field--wide">
          <span>Travel Preferences / Details</span>
          <textarea name="details" defaultValue={details} rows={14} maxLength={12000} placeholder="Airline, seat, hotel, trusted-traveler, and other travel notes…" aria-invalid={Boolean(state.fieldErrors?.details)} />
          <small>This private reference field is deliberately excluded from T.I.K.I. search.</small>
          {state.fieldErrors?.details && <small className="field-error">{state.fieldErrors.details}</small>}
        </label>
        <label className="form-field form-field--wide">
          <span>Flighty Link</span>
          <input name="flighty_url" type="url" defaultValue={flightyUrl} placeholder="https://…" aria-invalid={Boolean(state.fieldErrors?.flighty_url)} />
          <small>Optional link to externally maintained live flight or trip information.</small>
          {state.fieldErrors?.flighty_url && <small className="field-error">{state.fieldErrors.flighty_url}</small>}
        </label>
      </div>
      <div className="content-form__actions"><TravelSaveButton /></div>
    </form>
  );
}
