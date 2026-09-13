import { getIdentityAndProfile } from "@/lib/auth";
import { isUuid } from "@/lib/content-validation";
import { napkinSketchBucket, napkinSketchPath, normalizeNapkinSketch } from "@/lib/napkin-sketch";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "Content-Type": "image/png",
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'",
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return new Response(null, { status: 401, headers });
  const { id } = await params;
  if (!isUuid(id)) return new Response(null, { status: 404, headers });
  try {
    const client = await createClient();
    const record = await client.from("napkin_notes").select("id,created_by,sketch_path").eq("id", id).maybeSingle();
    const expected = record.data ? napkinSketchPath(record.data.created_by, id) : null;
    if (record.error || !record.data?.sketch_path || record.data.sketch_path !== expected) return new Response(null, { status: 404, headers });
    const result = await client.storage.from(napkinSketchBucket).download(record.data.sketch_path);
    if (result.error || !result.data) return new Response(null, { status: 404, headers });
    const image = await normalizeNapkinSketch(new Uint8Array(await result.data.arrayBuffer()), "image/png");
    return new Response(new Uint8Array(image), { headers });
  } catch {
    return new Response(null, { status: 404, headers });
  }
}
