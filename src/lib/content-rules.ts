import { hasMinimumRole } from "./access.ts";
import { contentConfigs, contentStatuses, napkinStatuses } from "./content.ts";
import type { AppRole, EntityKind, ManagedRecord } from "@/lib/types";

export function canCreateContent(role: AppRole, kind: EntityKind) {
  return hasMinimumRole(role, contentConfigs[kind].minimumCreateRole);
}

export function canEditContent(role: AppRole, userId: string, kind: EntityKind, record: Pick<ManagedRecord, "created_by" | "status">) {
  if (kind === "vendor_client") return hasMinimumRole(role, "editor");
  if (hasMinimumRole(role, "editor")) return true;
  if (record.created_by !== userId) return false;
  if (kind === "napkin") return record.status === "raw";
  return role === "contributor" && (record.status === "draft" || record.status === "submitted");
}

export function canArchiveContent(role: AppRole, userId: string, kind: EntityKind, record: Pick<ManagedRecord, "created_by" | "status">) {
  if (hasMinimumRole(role, "editor")) return true;
  return kind === "napkin" && record.created_by === userId && record.status === "raw";
}

export function canDeleteContent(role: AppRole) {
  return role === "admin";
}

export function allowedStatuses(role: AppRole, kind: EntityKind) {
  if (kind === "napkin") {
    return hasMinimumRole(role, "editor") ? [...napkinStatuses] : ["raw"];
  }
  return hasMinimumRole(role, "editor") ? [...contentStatuses] : ["draft", "submitted"];
}

export function canSetStatus(role: AppRole, kind: EntityKind, status: string) {
  return allowedStatuses(role, kind).includes(status as never);
}
