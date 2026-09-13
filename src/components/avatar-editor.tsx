"use client";
import { useActionState, useId, useState } from "react";
import { changeAvatar } from "@/app/(portal)/profile/actions";
import { MemberAvatar } from "@/components/member-avatar";
import { avatarLimit, avatarTypes } from "@/lib/avatar-config";
export function AvatarEditor({id,name,version}:{id:string;name:string;version:string}) {
  const [state,action,pending] = useActionState(changeAvatar,{message:""});
  const [fileError,setFileError] = useState("");
  const uploadId = useId();
  return <section className="panel profile-avatar-editor">
    <h2>Profile image</h2>
    <MemberAvatar id={id} name={name} version={version} />
    <form id={uploadId} action={action} className="content-form">
      <label className="form-field"><span>Choose a new image</span><input type="file" name="avatar" accept={avatarTypes.join(",")} disabled={pending} onChange={event=>{
        const file=event.currentTarget.files?.[0];
        setFileError(file && (file.size > avatarLimit || !avatarTypes.includes(file.type)) ? "Choose a JPEG, PNG or WebP no larger than 2 MB." : "");
      }} aria-invalid={!!fileError} aria-describedby="avatar-help" /></label>
      <p>JPEG, PNG or WebP, up to 2 MB and 16 megapixels. Your image is cropped to a square and shared only with active T.I.K.I. members.</p>
      <p id="avatar-help" role="status">{fileError}</p>
    </form>
    <div className="profile-avatar-actions"><button form={uploadId} className="secondary-button" name="intent" value="save" disabled={pending || !!fileError}>Save image</button><form action={action}><button className="secondary-button" name="intent" value="remove" disabled={pending}>Remove image</button></form></div>
    {state.message && <p role="status">{state.message}</p>}
  </section>;
}
