"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Save } from "lucide-react";

import { saveTravelAction, type TravelActionState } from "@/app/(portal)/travel/actions";

function TravelSaveButton() {
  const { pending } = useFormStatus();
  return <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving…" : <><Save size={16} /> Save travel details</>}</button>;
}

export function TravelForm({ name, details, flightyUrl, shareFlighty, shareBooking }: { name: string; details: string; flightyUrl: string; shareFlighty: boolean; shareBooking: boolean }) {
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
        <label className="switch-control travel-share-control"><input name="share_flighty" type="checkbox" value="true" defaultChecked={shareFlighty} /><span><strong>Visible to all active T.I.K.I. members</strong><small>Shares only your Flighty link, never the rest of these preferences.</small></span></label>
        <label className="switch-control travel-share-control"><input name="share_booking" type="checkbox" value="true" defaultChecked={shareBooking} /><span><strong>Share booking preferences with Production</strong><small>Read-only for authorized Production travel users and Admins.</small></span></label>
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
      <div className="content-form__actions content-form__actions--sticky"><TravelSaveButton /></div>
    </form>
  );
}
