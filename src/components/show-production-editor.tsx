"use client";

import Link from "next/link";
import { useState } from "react";
import { locationLabel, type ProductionLocation, type ShowStop } from "@/lib/show-production";

export function ShowProductionEditor({ locations, primaryId, initialStops, error, unavailable }: { locations: ProductionLocation[]; primaryId: string; initialStops: ShowStop[]; error?: string; unavailable?: boolean }) {
  const [stops, setStops] = useState(initialStops);
  function options(selected: string) {
    return <><option value="">Choose a Location</option>{selected && !locations.some((l) => l.id === selected) && <option value={selected}>Existing Location (unavailable)</option>}{locations.map((l) => <option key={l.id} value={l.id}>{locationLabel(l)}</option>)}</>;
  }
  function update(index: number, field: keyof ShowStop, value: string) { setStops(stops.map((s, i) => i === index ? { ...s, [field]: value } : s)); }
  function move(index: number, direction: number) { const next = [...stops]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setStops(next); }
  return <fieldset className="additional-links form-field--wide" data-error-name="show_locations">
    <legend>Production locations</legend>
    <label className="form-field"><span>Primary Location</span><select name="primary_location_id" defaultValue={primaryId} aria-invalid={Boolean(error)}>{options(primaryId)}</select></label>
    <p className="form-intro">Addresses, cities and maps belong to Locations. <Link href="/locations/new" target="_blank">Add a Location</Link>, then refresh this form before entering changes.</p>
    {unavailable && <p className="field-error">Locations could not be loaded. Refresh before saving.</p>}
    <input type="hidden" name="_show_stops" value={JSON.stringify(stops)} />
    <details open={stops.length > 0 || Boolean(error)}><summary>Additional stops / locations ({stops.length})</summary>
      <p className="form-intro">Optional, in itinerary order. A return visit can use the same Location again.</p>
      {stops.map((stop, index) => <div className="show-stop-row" key={index}>
        <label className="form-field"><span>Stop {index + 1}</span><select value={stop.location_id} onChange={(e) => update(index, "location_id", e.target.value)}>{options(stop.location_id)}</select></label>
        <label className="form-field"><span>Arrival / start</span><input type="date" value={stop.start_date} onChange={(e) => update(index, "start_date", e.target.value)} /></label>
        <label className="form-field"><span>Departure / end</span><input type="date" value={stop.end_date} onChange={(e) => update(index, "end_date", e.target.value)} /></label>
        <div className="page-actions"><button type="button" className="secondary-button" disabled={index === 0} onClick={() => move(index, -1)} aria-label={`Move stop ${index + 1} up`}>↑</button><button type="button" className="secondary-button" disabled={index === stops.length - 1} onClick={() => move(index, 1)} aria-label={`Move stop ${index + 1} down`}>↓</button><button type="button" className="secondary-button" onClick={() => setStops(stops.filter((_, i) => i !== index))}>Remove stop {index + 1}</button></div>
      </div>)}
      <button type="button" className="secondary-button" disabled={stops.length >= 100} onClick={() => setStops([...stops, { location_id: "", start_date: "", end_date: "" }])}>Add stop</button>
    </details>
    {error && <p className="field-error" role="alert">{error}</p>}
  </fieldset>;
}
