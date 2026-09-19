"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { moveShowPerson, showRolePresets, type ShowPerson } from "@/lib/show-details";

export function ShowPersonnelEditor({ initialPeople, error }: { initialPeople: ShowPerson[]; error?: string }) {
  const [people, setPeople] = useState(initialPeople);
  function update(id: string, values: Partial<ShowPerson>) {
    setPeople((current) => current.map((person) => person.id === id ? { ...person, ...values } : person));
  }
  return <fieldset className="additional-links form-field--wide show-personnel" data-error-name="key_personnel">
    <legend className="sr-only">Key Personnel</legend>
    <input type="hidden" name="_show_personnel" value={JSON.stringify(people.map((person, position) => ({ ...person, position })))} />
    <div className="additional-links__heading"><div><strong>Key Personnel</strong><small>Primary lighting, production, and show contacts.</small></div>
      <button className="secondary-button" type="button" disabled={people.length >= 50} onClick={() => setPeople((current) => [...current, { id: crypto.randomUUID(), role: "", name: "", company: "", email: "", phone: "", notes: "", primary: false, position: current.length }])}><Plus size={15} /> Add Person</button>
    </div>
    {!people.length && <p className="compact-empty">No key personnel added.</p>}
    {people.map((person, index) => <fieldset className="show-personnel__entry" key={person.id}>
      <legend>Person {index + 1}{person.name ? ` · ${person.name}` : ""}</legend>
      <div className="show-personnel__fields">
        <label className="form-field"><span>Role</span><select value={showRolePresets.includes(person.role) ? person.role : "custom"} onChange={(event) => update(person.id, { role: event.target.value === "custom" ? "" : event.target.value })}><option value="custom">Other / Custom</option>{showRolePresets.map((role) => <option key={role} value={role}>{role}</option>)}</select></label>
        {!showRolePresets.includes(person.role) && <label className="form-field"><span>Custom role</span><input value={person.role} maxLength={120} onChange={(event) => update(person.id, { role: event.target.value })} /></label>}
        <label className="form-field"><span>Name</span><input value={person.name} maxLength={160} onChange={(event) => update(person.id, { name: event.target.value })} /></label>
        <label className="form-field"><span>Company / Organization <em>optional</em></span><input value={person.company} maxLength={160} onChange={(event) => update(person.id, { company: event.target.value })} /></label>
        <label className="form-field"><span>Email <em>optional</em></span><input type="email" value={person.email} maxLength={254} onChange={(event) => update(person.id, { email: event.target.value })} /></label>
        <label className="form-field"><span>Phone <em>optional</em></span><input type="tel" value={person.phone} maxLength={80} onChange={(event) => update(person.id, { phone: event.target.value })} /></label>
        <label className="form-field form-field--wide"><span>Notes <em>optional</em></span><textarea value={person.notes} maxLength={2000} rows={2} onChange={(event) => update(person.id, { notes: event.target.value })} /></label>
      </div>
      <div className="show-personnel__actions"><label className="check-control"><input type="checkbox" checked={person.primary} onChange={(event) => update(person.id, { primary: event.target.checked })} /> Primary contact</label>
        <div><button className="icon-button" type="button" disabled={index === 0} aria-label={`Move ${person.name || `person ${index + 1}`} up`} onClick={() => setPeople((current) => moveShowPerson(current, index, -1))}><ArrowUp size={17} /></button>
          <button className="icon-button" type="button" disabled={index === people.length - 1} aria-label={`Move ${person.name || `person ${index + 1}`} down`} onClick={() => setPeople((current) => moveShowPerson(current, index, 1))}><ArrowDown size={17} /></button>
          <button className="icon-button" type="button" aria-label={`Remove ${person.name || `person ${index + 1}`}`} onClick={() => setPeople((current) => current.filter((entry) => entry.id !== person.id))}><Trash2 size={17} /></button></div>
      </div>
    </fieldset>)}
    {error && <small className="field-error" role="alert">{error}</small>}
  </fieldset>;
}
