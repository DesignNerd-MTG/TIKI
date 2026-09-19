import { orderShowPeople, readShowPeople } from "@/lib/show-details";

export function ShowPersonnelDetails({ value }: { value: unknown }) {
  const people = orderShowPeople(readShowPeople(value));
  return <section className="show-personnel-details" aria-label="Key Personnel"><h3>Key Personnel</h3>
    {!people.length && <p className="compact-empty">No key personnel added.</p>}
    <ul>{people.map((person) => <li key={person.id}>
      <div><strong>{person.name}</strong> — {person.role} {person.primary && <span className="show-personnel-details__primary">Primary</span>}</div>
      <div className="show-personnel-details__contact">{person.company && <span>{person.company}</span>}{person.email && <a href={`mailto:${person.email}`}>{person.email}</a>}{person.phone && <a href={`tel:${person.phone.replace(/[^+\d*#,;]/g, "")}`}>{person.phone}</a>}</div>
      {person.notes && <p>{person.notes}</p>}
    </li>)}</ul>
  </section>;
}
