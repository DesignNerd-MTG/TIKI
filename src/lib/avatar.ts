import sharp from "sharp";
import { avatarLimit, avatarPath } from "./avatar-config.ts";
export { avatarBucket, avatarLimit, avatarPath } from "./avatar-config.ts";
const formats = new Map([['image/jpeg','jpeg'],['image/png','png'],['image/webp','webp']]);

// Decode instead of trusting extensions/MIME; strip metadata and re-encode a
// single small square. SVG, animated images and decompression bombs are rejected.
export async function normalizeAvatar(bytes: Uint8Array, type: string): Promise<Buffer> {
  if (!bytes.length || bytes.length > avatarLimit) throw new Error("Choose an image no larger than 2 MB.");
  if (!formats.has(type)) throw new Error("Choose a JPEG, PNG or WebP image.");
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: "warning" });
    const meta = await image.metadata();
    if (meta.format !== formats.get(type) || (meta.pages ?? 1) !== 1) throw new Error();
    return await image.rotate().resize(256,256,{fit:"cover"}).webp({quality:82}).toBuffer();
  } catch {
    throw new Error("That image could not be read. Choose a still JPEG, PNG or WebP under 16 megapixels.");
  }
}

type Result = { error: unknown };
export type AvatarStore = {
  upload: (path: string, bytes: Buffer) => Promise<Result>;
  remove: (path: string) => Promise<Result>;
  publish: (enabled: boolean) => Promise<Result>;
};
export async function saveAvatar(store: AvatarStore, ownerId: string, bytes: Buffer) {
  // One deterministic owner-only object bounds orphan risk even on an RPC outage.
  if ((await store.upload(avatarPath(ownerId), bytes)).error) return "Could not upload your avatar. Please try again.";
  if ((await store.publish(true)).error) return "Image uploaded, but your profile could not be updated. Please retry.";
  return "Avatar saved.";
}
export async function removeAvatar(store: AvatarStore, ownerId: string) {
  if ((await store.remove(avatarPath(ownerId))).error) return "Could not remove your avatar. Please try again.";
  if ((await store.publish(false)).error) return "Image removed, but your profile could not be updated. Please retry.";
  return "Avatar removed.";
}
