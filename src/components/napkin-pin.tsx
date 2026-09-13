"use client";

import { useActionState } from "react";
import { Pin, PinOff } from "lucide-react";
import { setNapkinPinnedAction } from "@/app/(portal)/napkin/actions";

export function NapkinPin({ id, pinned }: { id: string; pinned: boolean }) {
  const [state, action, pending] = useActionState(setNapkinPinnedAction, { message: "" });
  const Icon = pinned ? PinOff : Pin;
  const label = pinned ? "Unpin Napkin" : "Pin Napkin";
  return <form action={action} className="napkin-pin-control">
    <input type="hidden" name="id" value={id} />
    <button type="submit" className="secondary-button" name="intent" value={pinned ? "unpin" : "pin"} disabled={pending} aria-label={label} title={label}>
      <Icon size={16} aria-hidden="true" /> {pending ? "Saving…" : label}
    </button>
    {state.message && <span className="sr-only" role="status">{state.message}</span>}
  </form>;
}
