"use client";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import { ReferenceCard } from "@/components/reference-card";
import type { ManagedRecord } from "@/lib/types";
export const referenceViewKey = "tiki.reference-view";
const eventName = "tiki-reference-view";
function readView() {
  try { return window.localStorage.getItem(referenceViewKey) === "list" ? "list" : "card"; }
  catch { return null; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(eventName, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(eventName, callback); };
}
export function ReferenceResults({ records, tags, sortControl }: { records: ManagedRecord[]; tags: Record<string, string[]>; sortControl?: ReactNode }) {
  const [fallback, setFallback] = useState<string | null>(null);
  const storedView = useSyncExternalStore(subscribe, readView, () => "card");
  const view = fallback ?? storedView ?? "card";
  const choose = (value: string) => {
    try { window.localStorage.setItem(referenceViewKey, value); setFallback(null); }
    catch { setFallback(value); }
    window.dispatchEvent(new Event(eventName));
  };
  return <div className="reference-results">
    <div className="page-actions" role="group" aria-label="Reference display">
      {(["card", "list"] as const).map(mode => <button key={mode} type="button" className="secondary-button" aria-pressed={view === mode} onClick={() => choose(mode)}>{mode === "card" ? "Card" : "List"}</button>)}
      {sortControl}
    </div>
    <div className={view === "card" ? "reference-grid reference-index" : "reference-list reference-index"}>
      {records.map(record => <ReferenceCard key={record.id} record={record} tags={tags[record.id]} compact list={view === "list"} />)}
    </div>
  </div>;
}
