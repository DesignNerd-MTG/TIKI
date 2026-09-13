"use client";
import { useActionState } from "react";
import { saveDirectoryName } from "@/app/(portal)/links/social/name-action";
export function DirectoryName({ name, expanded = false }: { name: string; expanded?: boolean }) {
  const [state, action, pending] = useActionState(saveDirectoryName, { message: "" });
  return <details className="directory-name" open={expanded || undefined}><summary>Your directory display name</summary><form action={action} className="content-form">
    <label className="form-field"><span>Directory display name</span><input name="display_name" defaultValue={name} required maxLength={100} /></label>
    <p>This name is shared with active T.I.K.I. members. Private Travel details are never used.</p>
    <button className="secondary-button" disabled={pending}>Save display name</button>
    {state.message && <p role="status">{state.message}</p>}
  </form></details>;
}
