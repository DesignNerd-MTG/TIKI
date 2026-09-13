"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { importNotionAction, recheckReferenceAction, saveSocialLinkAction } from "@/app/(portal)/links/reference-actions";
import type { ContentActionState } from "@/app/(portal)/content-actions";

const initial: ContentActionState = { ok: false, message: "" };
export function RecheckReference({ id }: { id: string }) {
  const [state, action, pending] = useActionState(recheckReferenceAction, initial);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state,router]);
  return <form action={action}><input type="hidden" name="id" value={id} /><button className="secondary-button" disabled={pending}>{pending ? "Checking…" : "Recheck Link"}</button>{state.message && <p role="status">{state.message}</p>}</form>;
}

export function NotionImportForm() {
  const [state, action, pending] = useActionState(importNotionAction, initial);
  return <form action={action} className="content-form"><label className="form-field"><span>Notion manifest JSON</span><textarea name="manifest" rows={16} maxLength={250000} required /></label>
    <p>Validate first. Each import saves up to 10 complete references as drafts and checks their links. Submit the same manifest again to continue; existing imports are skipped.</p>
    <div className="page-actions"><button className="secondary-button" name="mode" value="preview" disabled={pending}>Validate manifest</button><button className="primary-button" name="mode" value="import" disabled={pending}>{pending ? "Working…" : "Import next batch as drafts"}</button></div>
    {state.message && <pre className="reference-import-report" role="status">{state.message}</pre>}</form>;
}

export function SocialLinkForm({ item }: { item?: { id: string; label: string; url: string } }) {
  const [state, action, pending] = useActionState(saveSocialLinkAction, initial);
  const router = useRouter();
  useEffect(() => { if (state.ok) router.refresh(); }, [state,router]);
  return <form action={action} className="content-form">
    {item && <input name="id" type="hidden" value={item.id} />}
    <label className="form-field"><span>Label</span><input name="label" defaultValue={item?.label} maxLength={80} /></label>
    <label className="form-field"><span>Public URL</span><input type="url" name="url" defaultValue={item?.url} maxLength={2048} /></label>
    <div className="page-actions"><button className="primary-button" disabled={pending}>Save public link</button>{item && <button className="secondary-button" name="remove" value="true" disabled={pending}>Remove</button>}</div>
    {state.message && <p role="status">{state.message}</p>}
  </form>;
}
