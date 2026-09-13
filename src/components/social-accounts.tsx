"use client";
import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";
import { saveSocialAccountAction } from "@/app/(portal)/links/social/actions";
import { presentSocialAccount, socialInput, socialPlatforms, type SocialAccount, type SocialPlatform } from "@/lib/social-accounts";
import type { ContentActionState } from "@/app/(portal)/content-actions";
const initial: ContentActionState = { ok:false,message:"" };
type Target = { profile_id:string; display_name:string };
export function SocialAccountEditor({ item, targets, actorId }: { item?:SocialAccount; targets?:Target[]; actorId:string }) {
  const existing = item ? presentSocialAccount(item) : null;
  const [open,setOpen] = useState(false);
  const [platform,setPlatform] = useState<SocialPlatform>(existing?.platform ?? "Instagram");
  const [account,setAccount] = useState(existing?.input ?? "");
  const [state,action,pending] = useActionState(async (previous:ContentActionState, form:FormData)=>{
    const result = await saveSocialAccountAction(previous,form);
    if(result.ok) { setOpen(false); if(!item) setAccount(""); }
    return result;
  },initial);
  const router = useRouter();
  const errorId = useId();
  useEffect(()=>{ if(state.ok) router.refresh(); },[state,router]);
  return <div className="social-account-controls">
    {!open && <button type="button" className="secondary-button" onClick={()=>{if(item){setPlatform(existing!.platform);setAccount(existing!.input);}setOpen(true);}}>{item ? "Edit" : "+ Add another account"}</button>}
    {open && <form action={action} className="content-form social-account-form">
      {item && <input type="hidden" name="id" value={item.id} />}
      {!item && targets && <label className="form-field"><span>Member</span><select name="profile_id" defaultValue={actorId}>{targets.map(target=><option key={target.profile_id} value={target.profile_id}>{target.display_name}</option>)}</select></label>}
      {existing?.legacy && <p>This legacy link is preserved as saved. Choose its platform explicitly to convert it when saving.</p>}
      <label className="form-field"><span>Platform</span><select name="platform" value={platform} onChange={event=>{setPlatform(event.target.value as SocialPlatform);setAccount("");}}>{socialPlatforms.map(value=><option key={value}>{value}</option>)}</select></label>
      <label className="form-field"><span>{socialInput[platform].label}</span><input name="account" value={account} onChange={event=>setAccount(event.target.value)} placeholder={socialInput[platform].placeholder} required maxLength={2048} aria-invalid={Boolean(state.fieldErrors?.account)} aria-describedby={state.fieldErrors?.account ? errorId : undefined} /></label>
      {state.fieldErrors?.account && <p id={errorId} role="alert">{state.fieldErrors.account}</p>}
      <div className="page-actions"><button className="primary-button" disabled={pending}>{pending ? "Saving…" : "Save account"}</button><button type="button" className="secondary-button" disabled={pending} onClick={()=>setOpen(false)}>Cancel</button></div>
    </form>}
    {item && !open && <form action={action} onSubmit={event=>{if(!window.confirm("Remove this social account?"))event.preventDefault();}}><input type="hidden" name="id" value={item.id} /><input type="hidden" name="remove" value="true" /><button className="secondary-button" disabled={pending}>Remove</button></form>}
    {state.message && <p role="status">{state.message}</p>}
  </div>;
}
