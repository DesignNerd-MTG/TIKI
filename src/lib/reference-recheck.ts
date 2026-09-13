import { canEditContent } from "./content-rules.ts";
import type { AppRole, ManagedRecord } from "./types.ts";
import type { checkReference } from "./reference-fetch.ts";

type Check = Awaited<ReturnType<typeof checkReference>>;
type RecheckRecord = Pick<ManagedRecord, "status" | "created_by" | "updated_at"> & { url: string | null };
type Dependencies = {
  check: (url: string) => Promise<Check>;
  save: (result: Check, previousUpdatedAt: string) => Promise<boolean>;
  note: (summary: string) => Promise<boolean>;
};

export async function recheckReference(role: AppRole, userId: string, record: RecheckRecord, dependencies: Dependencies) {
  if (!canEditContent(role,userId,"link",record)) return { ok: false, message: "Your role cannot recheck this reference." };
  if (!record.url) return { ok: false, message: "Add an Authoritative URL before checking link health." };
  const result = await dependencies.check(record.url);
  const saved = await dependencies.save(result,record.updated_at).catch(() => false);
  if (!saved) return { ok: false, message: "The reference changed or could not be saved. Refresh and retry." };
  const noted = await dependencies.note("Manually rechecked reference: " + result.link_health.replaceAll("_"," ")).catch(() => false);
  return { ok: true, message: (result.link_health === "could_not_verify"
    ? "Couldn’t verify this destination. It may require sign-in or block automated checks."
    : "Link checked.") + (noted ? "" : " The check saved, but its revision note could not be saved.") };
}
