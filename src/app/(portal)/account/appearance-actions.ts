"use server";
import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { validPaletteTokens } from "@/lib/theme";
export type PaletteActionState={ok:boolean;message:string};
export async function updateCustomPaletteAction(_state:PaletteActionState,form:FormData):Promise<PaletteActionState>{
  const {identity}=await requireActiveProfile(); const client=await createClient();
  const slot=Number(form.get("slot")); const command=String(form.get("command")??"save");
  if(!Number.isInteger(slot)||slot<1||slot>3)return{ok:false,message:"Choose a valid custom palette slot."};
  if(command==="reset") { const removed=await client.from("user_custom_palettes").delete().eq("profile_id",identity.id).eq("slot",slot); if(removed.error)return{ok:false,message:"Palette could not be reset."}; await client.from("user_appearance").update({active_custom_slot:null}).eq("profile_id",identity.id).eq("active_custom_slot",slot); revalidatePath("/","layout"); return{ok:true,message:`Custom Palette ${slot} reset.`}; }
  if(command==="activate") { const exists=await client.from("user_custom_palettes").select("slot").eq("profile_id",identity.id).eq("slot",slot).maybeSingle(); if(!exists.data)return{ok:false,message:"Save this palette before activating it."}; const result=await client.from("user_appearance").upsert({profile_id:identity.id,active_custom_slot:slot},{onConflict:"profile_id"}); if(result.error)return{ok:false,message:"Palette could not be activated."}; revalidatePath("/","layout"); return{ok:true,message:`Custom Palette ${slot} is active.`}; }
  if(command==="preset") { const result=await client.from("user_appearance").upsert({profile_id:identity.id,active_custom_slot:null},{onConflict:"profile_id"}); if(result.error)return{ok:false,message:"Appearance could not be changed."}; revalidatePath("/","layout"); return{ok:true,message:"The curated site appearance is active."}; }
  const name=String(form.get("name")??"").trim(); const tokens=Object.fromEntries(["canvas","surface","primary_accent","secondary_accent","primary_text","muted_text"].map((key)=>[key,String(form.get(key)??"")]));
  if(!name||name.length>40)return{ok:false,message:"Use a palette name from 1 to 40 characters."};
  if(!validPaletteTokens(tokens))return{ok:false,message:"Every palette token must be a six-digit hex color."};
  const saved=await client.from("user_custom_palettes").upsert({profile_id:identity.id,slot,name,tokens},{onConflict:"profile_id,slot"});
  if(saved.error)return{ok:false,message:"Palette could not be saved."}; revalidatePath("/account"); return{ok:true,message:`${name} saved.`};
}
