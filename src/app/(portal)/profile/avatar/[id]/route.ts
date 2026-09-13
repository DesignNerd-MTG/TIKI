import { getIdentityAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { avatarBucket, avatarLimit, avatarPath, normalizeAvatar } from "@/lib/avatar";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = {"Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff", "Content-Security-Policy":"default-src 'none'"};
export async function GET(_request: Request, {params}: {params:Promise<{id:string}>}) {
  const {identity,profile} = await getIdentityAndProfile();
  if (!identity || !profile?.active) return new Response(null,{status:401,headers});
  const {id} = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return new Response(null,{status:404,headers});
  try {
    const client = await createClient();
    const {data:path,error} = await client.rpc("profile_avatar_path",{target_id:id});
    if (error || path !== avatarPath(id)) return new Response(null,{status:404,headers});
    const {data:file,error:downloadError} = await client.storage.from(avatarBucket).download(path);
    if (downloadError || !file || file.size > avatarLimit) return new Response(null,{status:404,headers});
    // Storage MIME constraints alone cannot guarantee that direct API uploads
    // contain images. Decode again before serving any untrusted stored bytes.
    const image = await normalizeAvatar(new Uint8Array(await file.arrayBuffer()),"image/webp");
    return new Response(new Uint8Array(image),{headers:{...headers,"Content-Type":"image/webp"}});
  } catch { return new Response(null,{status:404,headers}); }
}
