"use client";
import { useEffect,useState } from "react";
export function DashboardStatus(){
 const [now,setNow]=useState<Date|null>(null); const [location,setLocation]=useState("");
 useEffect(()=>{const initial=window.setTimeout(()=>setNow(new Date()),0); const timer=window.setInterval(()=>setNow(new Date()),60000); const controller=new AbortController();
   fetch("https://ipwho.is/",{signal:controller.signal,cache:"no-store"}).then(r=>r.ok?r.json():null).then(data=>{if(data?.success!==false){const place=[data?.city,data?.region].filter((v):v is string=>typeof v==="string"&&v.length>0).slice(0,2).join(", "); setLocation(place);}}).catch(()=>{});
   return()=>{window.clearTimeout(initial);window.clearInterval(timer);controller.abort()};},[]);
 if(!now)return <div className="dashboard-status" aria-label="Local status"/>;
 return <div className="dashboard-status" aria-label="Local status"><time dateTime={now.toISOString()}>{new Intl.DateTimeFormat(undefined,{hour:"numeric",minute:"2-digit"}).format(now)}</time><span>{new Intl.DateTimeFormat(undefined,{weekday:"short",month:"short",day:"numeric"}).format(now)}</span>{location&&<span>{location}</span>}</div>;
}
