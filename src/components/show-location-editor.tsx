"use client";

import { useEffect, useId, useState } from "react";
import type { ShowCity } from "@/lib/show-details";

export function ShowLocationEditor({ initialText, initialCity, initialMode, initialId, legacy, error }: {
  initialText: string; initialCity?: ShowCity | null; initialMode?: string; initialId?: string; legacy?: string; error?: string;
}) {
  const listId = useId();
  const [selected, setSelected] = useState(initialCity ?? null);
  const [selectedId, setSelectedId] = useState(initialId ?? initialCity?.id ?? "");
  const [query, setQuery] = useState(initialText);
  const [manual, setManual] = useState(initialMode ? initialMode === "manual" : Boolean(initialText && !initialCity));
  const [results, setResults] = useState<ShowCity[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (manual || selectedId || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("Searching cities…");
      try {
        const response = await fetch(`/api/show-cities?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const data = await response.json() as { cities: ShowCity[] };
        if (controller.signal.aborted) return;
        setResults(data.cities);
        setStatus(data.cities.length ? `${data.cities.length} suggestions available.` : "No matching city. Try a different spelling or use manual entry.");
      } catch {
        if (!controller.signal.aborted) { setResults([]); setStatus("City search is unavailable. Retry or use manual entry."); }
      }
    }, 200);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, manual, selectedId]);

  function select(city: ShowCity) {
    setSelected(city); setSelectedId(city.id); setQuery(city.display_name); setOpen(false); setResults([]); setActive(-1); setStatus("");
  }

  return <div className="form-field show-location" data-error-name="location">
    <label htmlFor={`${listId}-input`}>Location</label>
    <input type="hidden" name="location" value={query} />
    <input type="hidden" name="_show_city_id" value={selectedId} />
    <input type="hidden" name="_show_location_mode" value={manual ? "manual" : "city"} />
    {selectedId ? <div className="show-location__selected"><span>✓ {selected?.display_name ?? query}<small>Recognized city</small></span><button className="secondary-button" type="button" onClick={() => { setSelected(null); setSelectedId(""); setQuery(""); setStatus(""); }}>Change</button></div> : <>
      <input id={`${listId}-input`} value={query} maxLength={240} placeholder={manual ? "City / region / country" : "Search cities, e.g. Santa Monica"}
        role={manual ? undefined : "combobox"} aria-autocomplete={manual ? undefined : "list"} aria-expanded={manual ? undefined : open && results.length > 0}
        aria-controls={manual ? undefined : listId} aria-activedescendant={open && active >= 0 && results[active] ? `${listId}-${active}` : undefined}
        aria-invalid={Boolean(error)} aria-describedby={`${listId}-help`}
        onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onChange={(event) => { setQuery(event.target.value); setResults([]); setActive(-1); setOpen(true); setStatus(""); }}
        onKeyDown={(event) => {
          if (manual) return;
          if (event.key === "Escape") { setOpen(false); setActive(-1); }
          if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault(); setOpen(true);
            setActive((index) => results.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length : -1);
          }
          if (event.key === "Enter" && open) { event.preventDefault(); if (active >= 0 && results[active]) select(results[active]); }
        }} />
      {!manual && open && results.length > 0 && <ul className="show-city-results" id={listId} role="listbox" aria-label="City suggestions">
        {results.map((city, index) => <li key={city.id} id={`${listId}-${index}`} role="option" aria-selected={active === index}
          onMouseDown={(event) => event.preventDefault()} onClick={() => select(city)}>{city.display_name}</li>)}
      </ul>}
    </>}
    <small id={`${listId}-help`}>{manual ? "Manual location — not normalized. Enter a city or municipality; put the venue in Studio / Site." : "City / municipality only. Choose a suggestion to save its normalized location."}</small>
    {!selectedId && <button className="text-button" type="button" onClick={() => { setManual(!manual); setResults([]); setStatus(""); setActive(-1); }}>{manual ? "Search recognized cities instead" : "Can’t find it? Enter manually"}</button>}
    {!manual && !selectedId && <small role="status">{status}</small>}
    {legacy && <small className="show-legacy-location">Original location (preserved): {legacy}</small>}
    <small>City data: <a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">CC BY 4.0</a></small>
    {error && <small className="field-error">{error}</small>}
  </div>;
}
