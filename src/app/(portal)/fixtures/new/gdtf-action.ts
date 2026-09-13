"use server";

import { requireActiveProfile } from "@/lib/auth";
import { GdtfError, gdtfLimits, parseGdtf } from "@/lib/gdtf";
import type { GdtfActionState } from "@/lib/gdtf-review";

export async function reviewGdtfAction(form: FormData): Promise<GdtfActionState> {
  await requireActiveProfile("contributor");
  const file = form.get("gdtf");
  if (!(file instanceof File) || !file.size || file.size > gdtfLimits.upload) return { error: "Choose a non-empty .gdtf file no larger than 2 MB." };
  try {
    return { review: await parseGdtf(Buffer.from(await file.arrayBuffer()), file.name) };
  } catch (error) {
    // Never log uploaded XML, raw parser errors, or user metadata.
    return { error: error instanceof GdtfError ? error.message : "This GDTF could not be read safely. Try re-exporting it or use Add Manually." };
  }
}
