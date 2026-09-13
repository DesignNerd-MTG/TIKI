import sharp from "sharp";

export const napkinSketchBucket = "napkin-sketches";
export const napkinSketchUploadLimit = 8 * 1024 * 1024;
export const napkinSketchStoredLimit = 5 * 1024 * 1024;
export const napkinSketchMaxPixels = 12_000_000;

export function napkinSketchPath(ownerId: string, napkinId: string) {
  return `${ownerId}/${napkinId}.png`;
}

export async function normalizeNapkinSketch(bytes: Uint8Array, mimeType: string) {
  if (mimeType !== "image/png" || !bytes.length || bytes.length > napkinSketchUploadLimit) {
    throw new Error("The sketch must be a PNG no larger than 8 MB.");
  }
  const source = sharp(bytes, { limitInputPixels: napkinSketchMaxPixels });
  const metadata = await source.metadata();
  if (metadata.format !== "png" || !metadata.width || !metadata.height || metadata.width * metadata.height > napkinSketchMaxPixels) {
    throw new Error("The sketch image is invalid or too large.");
  }
  const output = await source
    .resize({ width: 1800, height: 1400, fit: "inside", withoutEnlargement: true })
    .flatten({ background: "#000000" })
    .png({ compressionLevel: 9 })
    .toBuffer();
  if (output.length > napkinSketchStoredLimit) throw new Error("The processed sketch is too large to store.");
  return output;
}
