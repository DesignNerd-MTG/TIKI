"use client";

import { usePathname } from "next/navigation";
import { Share2 } from "lucide-react";
import { useRef, useState } from "react";

export function ShareRecord({ title }: { title: string }) {
  const pathname = usePathname();
  const [feedback, setFeedback] = useState("Share");
  const resetTimer = useRef<number | null>(null);

  function report(label: string) {
    setFeedback(label);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setFeedback("Share"), 1800);
  }

  async function share() {
    const url = new URL(pathname, window.location.origin).href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        report("Shared");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      report("Copied");
    } catch {
      report("Copy failed");
    }
  }

  return <button className="secondary-button share-record" type="button" onClick={share} aria-live="polite"><Share2 size={15} /> {feedback}</button>;
}
