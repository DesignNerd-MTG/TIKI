import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import http from "node:http";
import https from "node:https";

const blocked = new BlockList();
for (const [address, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
  ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
  ["192.88.99.0", 24], ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) blocked.addSubnet(address, prefix, "ipv4");
for (const [address, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) blocked.addSubnet(address, prefix, "ipv6");
const globalV6 = new BlockList();
globalV6.addSubnet("2000::", 3, "ipv6");

export function isPublicAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return !blocked.check(address, "ipv4");
  return family === 6 && globalV6.check(address, "ipv6") && !blocked.check(address, "ipv6");
}

export function parseFetchUrl(value: string) {
  const url = new URL(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && !["80", "443"].includes(url.port)) || value.length > 2048 ||
      !hostname.includes(".") && !isIP(hostname) ||
      /(^|\.)(localhost|local|internal|home|lan|test|invalid|example|onion)$/.test(hostname) ||
      hostname === "metadata.google.internal" || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new Error("Destination is not a public HTTP(S) address.");
  }
  url.hash = "";
  return url;
}

type Address = { address: string; family: number };
type Reply = { status: number; headers: Record<string, string | string[] | undefined>; body: Buffer };
export type FetchDependencies = {
  resolve: (hostname: string) => Promise<Address[]>;
  request: (url: URL, address: Address, signal: AbortSignal, limit: number) => Promise<Reply>;
};

export const pinnedRequest: FetchDependencies["request"] = (url, address, signal, limit) =>
  new Promise((resolve, reject) => {
    // Connect directly to the validated IP, retaining the original Host and TLS SNI.
    // No second DNS lookup, proxy environment variables, credentials, or cookies.
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(url, {
      method: "GET", agent: false, signal,
      headers: { "User-Agent": "TIKI-Reference-Check/1.0", Accept: "text/html,image/png,image/jpeg,image/webp,image/gif;q=0.8", "Accept-Encoding": "identity" },
      lookup: (_hostname, options, callback) => {
        if (typeof options === "object" && options.all) callback(null, [address]);
        else callback(null, address.address, address.family);
      },
    }, (res) => {
      res.on("error", reject);
      const chunks: Buffer[] = [];
      let size = 0;
      const status = res.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        resolve({ status, headers: res.headers, body: Buffer.alloc(0) });
        res.destroy();
        return;
      }
      if (Number(res.headers["content-length"]) > limit) {
        res.destroy(new Error("Response too large."));
        return;
      }
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > limit) res.destroy(new Error("Response too large."));
        else chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.end();
  });

const defaults: FetchDependencies = {
  resolve: (hostname) => lookup(hostname, { all: true, verbatim: true }),
  request: pinnedRequest,
};

export async function safeFetch(value: string, dependencies = defaults, limit = 512 * 1024, timeoutMs = 7000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const aborted = new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(new Error("Fetch timed out.")), { once: true });
  });
  async function run() {
    let url = parseFetchUrl(value);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const hostname = url.hostname.replace(/^\[|\]$/g, "");
      const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await dependencies.resolve(hostname);
      if (controller.signal.aborted) throw new Error("Fetch timed out.");
      // Reject mixed public/private DNS answers; pin the actual connection to one answer.
      if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("Unsafe DNS resolution.");
      const reply = await dependencies.request(url, addresses[0], controller.signal, limit);
      if (reply.body.length > limit) throw new Error("Response too large.");
      if ([301, 302, 303, 307, 308].includes(reply.status)) {
        const location = reply.headers.location;
        if (redirects === 3 || typeof location !== "string") throw new Error("Redirect limit or missing target.");
        url = parseFetchUrl(new URL(location, url).href);
        continue;
      }
      return { ...reply, finalUrl: url.href, redirected: redirects > 0 };
    }
    throw new Error("Redirect limit.");
  }
  try { return await Promise.race([run(), aborted]); }
  finally { clearTimeout(timer); controller.abort(); }
}

function metadataText(value: string, limit: number) {
  // PostgreSQL text/JSON cannot contain NUL or unpaired UTF-16 surrogates.
  // Count Unicode code points so truncation never splits supplementary characters.
  return Array.from(value.toWellFormed().replaceAll("\0", "")).slice(0, limit).join("");
}

function decode(value: string) {
  const decoded = value.replace(/&(?:amp|quot|apos|lt|gt|#39|#(\d+)|#x([0-9a-f]+));/gi, (match, decimal, hex) => {
    if (decimal || hex) {
      const code = Number.parseInt(decimal || hex, hex ? 16 : 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return ({ "&amp;": "&", "&quot;": '"', "&apos;": "'", "&lt;": "<", "&gt;": ">", "&#39;": "'" } as Record<string, string>)[match.toLowerCase()] ?? match;
  }).replace(/\s+/g, " ").trim();
  return metadataText(decoded, 2048);
}

export function extractMetadata(html: string, finalUrl: string) {
  const values = new Map<string, string>();
  let favicon = "";
  for (const tag of html.match(/<(?:meta|link)\b[^>]{0,8192}>/gi) ?? []) {
    const attrs = new Map<string, string>();
    for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
      attrs.set(match[1].toLowerCase(), decode(match[2] ?? match[3] ?? match[4]));
    }
    const key = attrs.get("property") || attrs.get("name");
    if (key && attrs.get("content")) values.set(key.toLowerCase(), attrs.get("content")!);
    if ((attrs.get("rel") ?? "").split(/\s+/).includes("icon")) favicon ||= attrs.get("href") ?? "";
  }
  function asset(value: string) {
    if (!value) return null;
    try { return metadataText(parseFetchUrl(new URL(value, finalUrl).href).href, 2048); } catch { return null; }
  }
  return {
    site_name: metadataText(values.get("og:site_name") || new URL(finalUrl).hostname, 200),
    fetched_title: metadataText(values.get("og:title") || values.get("twitter:title") || decode(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? ""), 500) || null,
    favicon_url: asset(favicon || "/favicon.ico"),
    preview_image_url: asset(values.get("og:image") || values.get("twitter:image") || ""),
  };
}

export async function checkReference(value: string, dependencies = defaults) {
  const empty = { site_name: null as string | null, fetched_title: null as string | null, favicon_url: null as string | null, preview_image_url: null as string | null };
  const checked = { last_checked_at: new Date().toISOString() };
  try {
    const reply = await safeFetch(value, dependencies);
    const contentType = String(reply.headers["content-type"] ?? "");
    const success = reply.status >= 200 && reply.status < 300;
    return {
      ...empty,
      ...(success && /text\/html|application\/xhtml\+xml/i.test(contentType) ? extractMetadata(reply.body.toString("utf8"), reply.finalUrl) : {}),
      ...checked,
      final_url: metadataText(reply.finalUrl, 2048),
      link_health: success ? (reply.redirected ? "redirected" : "healthy") : [404, 410].includes(reply.status) ? "unavailable" : "could_not_verify",
    };
  } catch {
    // Authenticated/private sites, network errors and blocked destinations stay saveable.
    return { ...empty, ...checked, final_url: null, link_health: "could_not_verify" };
  }
}
