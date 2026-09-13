"use server";

import { requireActiveProfile } from "@/lib/auth";
import { GdtfError, parseGdtf } from "@/lib/gdtf";
import { validateGdtfUpload } from "@/lib/gdtf-review";
import type { GdtfActionState } from "@/lib/gdtf-review";

export async function reviewGdtfAction(form: FormData): Promise<GdtfActionState> {
  await requireActiveProfile("contributor");
  const file = form.get("gdtf");
  const error = validateGdtfUpload(file instanceof File ? file : null);
  if (error || !(file instanceof File)) return { error };
  try {
    return { review: await parseGdtf(Buffer.from(await file.arrayBuffer()), file.name) };
  } catch (error) {
    // Never log uploaded XML, raw parser errors, or user metadata.
    return { error: error instanceof GdtfError ? error.message : "This GDTF could not be read safely. Try re-exporting it or use Add Manually." };
  }
}
