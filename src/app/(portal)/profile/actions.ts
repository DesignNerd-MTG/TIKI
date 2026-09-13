"use server";
import { revalidatePath } from "next/cache";
import { requireActiveProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avatarBucket, avatarLimit, normalizeAvatar, saveAvatar, removeAvatar, type AvatarStore } from "@/lib/avatar";

export async function changeAvatar(_state: {message:string}, form: FormData) {
  const {identity} = await requireActiveProfile();
  const client = await createClient();
  const bucket = client.storage.from(avatarBucket);
  const store: AvatarStore = {
    upload: async(path,bytes) => bucket.upload(path,bytes,{contentType:"image/webp",upsert:true,cacheControl:"0"}),
    remove: async(path) => bucket.remove([path]),
    publish: async(enabled) => client.rpc("set_profile_avatar",{enabled}),
  };
  let message: string;
  try {
    if (form.get("intent") === "remove") message = await removeAvatar(store,identity.id);
    else {
      const file = form.get("avatar");
      if (!(file instanceof File) || !file.size) return {message:"Choose an image first."};
      if (file.size > avatarLimit) return {message:"Choose an image no larger than 2 MB."};
      let bytes: Buffer;
      try { bytes = await normalizeAvatar(new Uint8Array(await file.arrayBuffer()),file.type); }
      catch(error) { return {message:error instanceof Error ? error.message : "Invalid image."}; }
      message = await saveAvatar(store,identity.id,bytes);
    }
  } catch { message = "Could not update your avatar. Please try again."; }
  revalidatePath("/", "layout");
  return {message};
}
