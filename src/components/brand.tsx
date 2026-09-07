import Link from "next/link";

type BrandProps = {
  href?: string;
  compact?: boolean;
  inverse?: boolean;
};

export function Brand({ href = "/", compact = false, inverse = false }: BrandProps) {
  const content = (
    <span className={`brand ${compact ? "brand--compact" : ""} ${inverse ? "brand--inverse" : ""}`}>
      <span className="brand__mark" aria-hidden="true">
        <span className="brand__sun" />
        <span className="brand__horizon" />
        <span className="brand__water brand__water--one" />
        <span className="brand__water brand__water--two" />
      </span>
      <span className="brand__copy">
        <span className="brand__name">T.I.K.I.</span>
        {!compact && (
          <span className="brand__descriptor">Technical Information &amp; Knowledge Index</span>
        )}
      </span>
    </span>
  );

  return href ? (
    <Link className="brand-link" href={href} aria-label="T.I.K.I. home">
      {content}
    </Link>
  ) : (
    content
  );
}
