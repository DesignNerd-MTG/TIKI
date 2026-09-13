export function NapkinSketch({ id, version }: { id: string; version: string }) {
  return (
    <section className="panel napkin-sketch-detail" aria-labelledby="napkin-sketch-heading">
      <div className="panel__heading"><div><p className="eyebrow">Attached sketch</p><h2 id="napkin-sketch-heading">Drawn on this Napkin</h2></div></div>
      {/* Authenticated, same-origin endpoint; never render a storage or public object URL. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/napkin/sketch/${encodeURIComponent(id)}?v=${encodeURIComponent(version)}`} alt="Sketch attached to this Napkin" />
    </section>
  );
}
