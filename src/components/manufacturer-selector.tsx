"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, Search, X } from "lucide-react";

import { addFixtureManufacturerAction, type ManufacturerActionState } from "@/app/(portal)/content-actions";
import { manufacturerMatchesQuery, type FixtureManufacturer } from "@/lib/fixture-manufacturers";

const initialActionState: ManufacturerActionState = { ok: false, message: "" };

export function ManufacturerSelector({
  manufacturers,
  initialId = "",
  initialName = "",
  canAdd,
  error,
  isNew = false,
}: {
  manufacturers: FixtureManufacturer[];
  initialId?: string;
  initialName?: string;
  canAdd: boolean;
  error?: string;
  isNew?: boolean;
}) {
  const [options, setOptions] = useState(manufacturers);
  const [selectedId, setSelectedId] = useState(initialId);
  const [selectedName, setSelectedName] = useState(initialId ? initialName : "");
  const [query, setQuery] = useState(initialName);
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAliases, setNewAliases] = useState("");
  const [actionState, setActionState] = useState(initialActionState);
  const [pending, startTransition] = useTransition();
  const filtered = useMemo(() => options.filter((option) => option.active && manufacturerMatchesQuery(option, query)).slice(0, 12), [options, query]);
  const unresolvedLegacy = Boolean(initialName && !initialId && !selectedId);

  useEffect(() => {
    if (!showAdd) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAdd(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showAdd]);

  function choose(option: FixtureManufacturer) {
    setSelectedId(option.id);
    setSelectedName(option.name);
    setQuery(option.name);
    setExpanded(false);
    setShowAdd(false);
  }

  function submitManufacturer() {
    const formData = new FormData();
    formData.set("name", newName);
    formData.set("aliases", newAliases);
    startTransition(async () => {
      const result = await addFixtureManufacturerAction(formData);
      setActionState(result);
      if (result.ok && result.manufacturer) {
        setOptions((current) => [...current, result.manufacturer!].sort((a, b) => a.name.localeCompare(b.name)));
        choose(result.manufacturer);
        setNewName("");
        setNewAliases("");
      }
    });
  }

  return (
    <div className="form-field manufacturer-selector">
      <span>Manufacturer<em> required</em></span>
      <input type="hidden" name="manufacturer_id" value={selectedId} />
      <input type="hidden" name="manufacturer" value={selectedId ? selectedName : initialName} />
      <div className="manufacturer-selector__control">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={query}
          placeholder="Search manufacturers or aliases"
          autoComplete="off"
          aria-label="Search and choose a manufacturer"
          role="combobox"
          aria-controls="manufacturer-options"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-invalid={Boolean(error)}
          onFocus={() => setExpanded(true)}
          onBlur={() => setExpanded(false)}
          onChange={(event) => {
            const value = event.target.value;
            setQuery(value);
            setExpanded(true);
            if (value !== selectedName) {
              setSelectedId("");
              setSelectedName("");
            }
          }}
        />
      </div>
      {expanded && (
        <div className="manufacturer-selector__results" id="manufacturer-options" role="listbox" aria-label="Manufacturer choices">
          {filtered.map((option) => (
            <button key={option.id} type="button" role="option" aria-selected={selectedId === option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
              <strong>{option.name}</strong>
              {option.aliases.length > 0 && <small>{option.aliases.join(" · ")}</small>}
            </button>
          ))}
          {!filtered.length && <p>No canonical manufacturer matches “{query}”.</p>}
        </div>
      )}
      {selectedId && <small className="manufacturer-selector__selected">Selected: {selectedName}</small>}
      {unresolvedLegacy && <small className="field-error">{isNew ? `Imported manufacturer “${initialName}” is unresolved. Choose a canonical manufacturer before creating this Fixture.` : `Legacy value “${initialName}” is unresolved. It will be preserved until an Editor chooses the correct canonical manufacturer.`}</small>}
      {error && <small className="field-error">{error}</small>}
      <small>Type a canonical name or a common alias such as HES, VL, or Chauvet Pro.</small>
      {canAdd && <button className="text-button manufacturer-selector__add" type="button" onClick={() => { setShowAdd(true); setActionState(initialActionState); setNewName(query === initialName ? "" : query); }}><Plus size={15} /> Add Manufacturer</button>}

      {showAdd && (
        <div className="manufacturer-dialog-backdrop" role="presentation">
          <section className="manufacturer-dialog" role="dialog" aria-modal="true" aria-labelledby="manufacturer-dialog-title">
            <button className="icon-button manufacturer-dialog__close" type="button" aria-label="Close Add Manufacturer" onClick={() => setShowAdd(false)}><X size={18} /></button>
            <p className="eyebrow">Canonical taxonomy</p>
            <h2 id="manufacturer-dialog-title">Add Manufacturer</h2>
            <p>Add a genuinely new brand only. T.I.K.I. checks canonical names and aliases before creating it.</p>
            {actionState.message && <div className={`notice ${actionState.ok ? "notice--success" : "notice--warning"}`} role="status">{actionState.message}</div>}
            {actionState.candidates?.length ? (
              <div className="manufacturer-dialog__candidates">
                {actionState.candidates.map((candidate) => <button type="button" className="secondary-button" key={candidate.id} onClick={() => choose(candidate)}>{candidate.name}</button>)}
              </div>
            ) : null}
            <label className="form-field"><span>Canonical name</span><input value={newName} maxLength={120} autoFocus onChange={(event) => setNewName(event.target.value)} aria-invalid={Boolean(actionState.fieldErrors?.name)} />{actionState.fieldErrors?.name && <small className="field-error">{actionState.fieldErrors.name}</small>}</label>
            <label className="form-field"><span>Aliases (optional)</span><input value={newAliases} maxLength={600} placeholder="Comma-separated field names" onChange={(event) => setNewAliases(event.target.value)} aria-invalid={Boolean(actionState.fieldErrors?.aliases)} />{actionState.fieldErrors?.aliases && <small className="field-error">{actionState.fieldErrors.aliases}</small>}</label>
            <div className="content-form__actions"><button className="primary-button" type="button" disabled={pending} onClick={submitManufacturer}>{pending ? "Checking…" : "Check & add"}</button></div>
          </section>
        </div>
      )}
    </div>
  );
}
