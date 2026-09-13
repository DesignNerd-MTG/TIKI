/* eslint-disable @next/next/no-img-element -- Remote images use our authenticated SSRF-safe image route. */
import Link from "next/link";
import { collectionLabel, healthLabels } from "@/lib/references";
import { formatDate } from "@/lib/format";
import { isSafeExternalUrl } from "@/lib/content-validation";
import type { ManagedRecord } from "@/lib/types";

export function ReferenceCard({ record, tags = [], compact = false, list = false }: { record: ManagedRecord; tags?: string[]; compact?: boolean; list?: boolean }) {
  const str = (key: string) => typeof record[key] === "string" ? String(record[key]) : "";
  const image = (key: string) => str(key) && isSafeExternalUrl(str(key)) ? "/links/image?url=" + encodeURIComponent(str(key)) : "";
  let domain = "";
  try { domain = new URL(str("url")).hostname; } catch { /* Invalid legacy URL stays non-clickable. */ }
  return <article className={`panel reference-card${compact ? " reference-card--compact" : ""}${list ? " reference-card--list" : ""}`}>
    {!list && image("preview_image_url") && <img className="reference-card__image" src={image("preview_image_url")} alt="" loading="lazy" referrerPolicy="no-referrer" />}
    <div className="reference-card__body">
      <p className="reference-card__site">{image("favicon_url") && <img src={image("favicon_url")} width={20} height={20} alt="" loading="lazy" />} {str("site_name") || (compact ? domain : "")}</p>
      <h2><Link href={"/links/" + record.id}>{str("label") || str("fetched_title") || str("url")}</Link></h2>
      <p>{collectionLabel(record.collection_id,record.subcollection_id)}</p>
      {!list && str("description") && <p className="reference-card__notes">{str("description")}</p>}
      {tags.length > 0 && <div className="tag-list">{tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
      <p className="reference-card__health">{healthLabels[str("link_health")] ?? "Couldn’t Verify"} · {record.status}</p>
      <p className="reference-card__dates">Date Added: {formatDate(str("date_added") || record.created_at)}<br />{str("last_checked_at") ? "Last Checked: " + formatDate(str("last_checked_at")) : "Not checked yet"}</p>
      {isSafeExternalUrl(str("url")) && str("url") && <a className="text-link" href={str("url")} rel="noreferrer" target="_blank">Open reference ↗</a>}
    </div>
  </article>;
}
