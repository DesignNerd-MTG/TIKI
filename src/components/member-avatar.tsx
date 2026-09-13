"use client";
import { useState } from "react";
import { initials } from "@/lib/format";
export function MemberAvatar({id,name,version=""}:{id?:string;name:string;version?:string}) {
  const src = id ? `/profile/avatar/${encodeURIComponent(id)}?v=${encodeURIComponent(version)}` : "";
  const [failed,setFailed] = useState<string|null>(null);
  return <span className="avatar member-avatar" aria-hidden="true">
    {src && failed !== src ?
      // Authenticated same-origin endpoint; never render external profile URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" width={36} height={36} loading="lazy" onError={()=>setFailed(src)} />
      : initials(name)}
  </span>;
}
