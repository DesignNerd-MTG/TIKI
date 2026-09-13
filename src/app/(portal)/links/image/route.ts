import { getIdentityAndProfile } from "@/lib/auth";
import { safeFetch } from "@/lib/reference-fetch";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const { identity, profile } = await getIdentityAndProfile();
  if (!identity || !profile?.active) return new Response(null, { status: 401 });
  const url = new URL(request.url).searchParams.get("url");
  if (!url) return new Response(null, { status: 400 });
  try {
    const image = await safeFetch(url, undefined, 1024 * 1024);
    const type = String(image.headers["content-type"] ?? "").split(";")[0].trim();
    if (image.status !== 200 || !["image/png","image/jpeg","image/webp","image/gif","image/x-icon","image/vnd.microsoft.icon"].includes(type)) return new Response(null,{status:404});
    return new Response(new Uint8Array(image.body), { headers: { "Content-Type": type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600", "Content-Security-Policy": "default-src 'none'; sandbox" } });
  } catch { return new Response(null, { status: 404 }); }
}
