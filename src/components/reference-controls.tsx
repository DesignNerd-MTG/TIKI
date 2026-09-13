"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { importNotionAction, recheckReferenceAction } from "@/app/(portal)/links/reference-actions";
import type { ContentActionState } from "@/app/(portal)/content-actions";

const initial: ContentActionState = { ok: false, message: "" };
export function RecheckReference({ id }: { id: string }) {
  const [state, action, pending] = useActionState(recheckReferenceAction, initial);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state,router]);
  return <form action={action}><input type="hidden" name="id" value={id} /><button className="secondary-button" disabled={pending}>{pending ? "Checking…" : "Recheck Link"}</button>{state.message && <p role="status">{state.message}</p>}</form>;
}

export function NotionImportForm() {
  const [manifest, setManifest] = useState("");
  const [state, action, pending] = useActionState(importNotionAction, initial);
  return <form action={action} className="content-form"><label className="form-field"><span>Notion manifest JSON</span><textarea name="manifest" value={manifest} onChange={(event) => setManifest(event.target.value)} rows={16} maxLength={250000} required /></label>
    <p>Validate first. Each import saves up to 10 complete references as drafts and checks their links. Submit the same manifest again to continue; existing imports are skipped.</p>
    <div className="page-actions"><button className="secondary-button" name="mode" value="preview" disabled={pending}>Validate manifest</button><button className="primary-button" name="mode" value="import" disabled={pending}>{pending ? "Working…" : "Import next batch as drafts"}</button></div>
    {state.message && <pre className="reference-import-report" role="status">{state.message}</pre>}</form>;
}
