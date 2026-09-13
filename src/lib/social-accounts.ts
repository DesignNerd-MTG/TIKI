export const socialPlatforms = ["Instagram", "TikTok", "Personal Website"] as const;
export type SocialPlatform = typeof socialPlatforms[number];
export type SocialAccount = { id: string; profile_id: string; display_name: string; label: string; url: string };
export const socialInput = {
  Instagram: { label: "Instagram handle", placeholder: "@mtgdesigns" },
  TikTok: { label: "TikTok handle", placeholder: "@mtgdesigns" },
  "Personal Website": { label: "Website", placeholder: "mtgdesigns.net" },
};

export function normalizeSocialAccount(platform: string, raw: string) {
  if (!socialPlatforms.includes(platform as SocialPlatform)) throw new Error("Choose a supported platform.");
  if (!raw.isWellFormed() || /[\u0000-\u001f\u007f]/.test(raw) || raw.length > 2048) throw new Error("Enter a valid account without control characters (up to 2048 characters).");
  const value = raw.trim();
  if (!value || /\s/.test(value)) throw new Error("Enter a handle or website without spaces.");
  if (platform === "Personal Website") {
    let url: URL;
    try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : "https://" + value); }
    catch { throw new Error("Enter a valid website, such as mtgdesigns.net."); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || !url.hostname.includes(".") || /[\\]/.test(value) || url.href.length > 2048) throw new Error("Use a complete HTTP(S) website without login credentials.");
    return { label: platform, url: url.href, display: url.hostname };
  }
  let handle = value;
  const host = platform === "Instagram" ? "instagram.com" : "tiktok.com";
  if (/[/\\:]|^(?:www\.)?(?:instagram|tiktok)\.com/i.test(value)) {
    let url: URL;
    try { url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value); }
    catch { throw new Error("Enter a profile handle or profile URL."); }
    if (!["http:","https:"].includes(url.protocol) || ![host,"www."+host].includes(url.hostname) || url.port || url.username || url.password || /\\/.test(value)) throw new Error("Use a " + platform + " profile URL.");
    const match = platform === "Instagram" ? /^\/([a-z\d._]+)\/?$/i.exec(url.pathname) : /^\/@([a-z\d._]+)\/?$/i.exec(url.pathname);
    if (!match) throw new Error("Use a profile, not a post, reel, video, or share link.");
    handle = match[1];
  } else handle = handle.replace(/^@/, "");
  const limit = platform === "Instagram" ? 30 : 24;
  if (!/^[a-z\d_](?:[a-z\d._]*[a-z\d_])?$/i.test(handle) || handle.length > limit || handle.includes("..") || ["p","reel","reels","stories","explore","accounts","share","video"].includes(handle.toLowerCase())) throw new Error("Enter a valid " + platform + " profile handle.");
  handle = handle.toLowerCase();
  return { label: platform, url: platform === "Instagram" ? `https://www.instagram.com/${handle}/` : `https://www.tiktok.com/@${handle}`, display: "@"+handle };
}

// Unknown legacy links stay intact and visible; only an explicit edit converts them.
export function presentSocialAccount(row: { label: string; url: string }) {
  for (const platform of socialPlatforms) {
    if (platform === "Personal Website" && !["personal website","website","portfolio"].includes(row.label.toLowerCase())) continue;
    try {
      const account = normalizeSocialAccount(platform,row.url);
      return { ...account, platform, input: platform === "Personal Website" ? account.url : account.display, legacy: false };
    } catch { /* Try another confidently identified platform. */ }
  }
  return { label: row.label, url: row.url, display: row.label, platform: "Personal Website" as SocialPlatform, input: row.url, legacy: true };
}

export function canManageSocial(role: string, actor: string, owner: string) {
  return role === "admin" || actor === owner;
}
