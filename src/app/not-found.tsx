import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="centered-message">
      <p className="eyebrow">404 · Off the map</p>
      <h1>T.I.K.I. can’t find that page.</h1>
      <p>The record may have moved, been archived, or never made it off the Napkin.</p>
      <Link className="primary-button" href="/dashboard"><ArrowLeft size={17} /> Back to dashboard</Link>
    </main>
  );
}
