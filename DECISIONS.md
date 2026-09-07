# T.I.K.I. decisions

## Product

- T.I.K.I. means **Technical Information & Knowledge Index**.
- The success phrase is “Check T.I.K.I.”
- T.I.K.I. is the map, not the territory. It indexes existing working systems instead of replacing them.
- Search and fast retrieval are the center of the experience.
- Fixture pages are answer-first and show LDG practice before manufacturer detail.
- T.I.K.I. Napkin is the informal capture layer for raw notes, links, warnings, field observations, and half-formed institutional knowledge.
- Napkin notes move toward `needs_review`, `converted`, or `archived` as editors triage them; this pass intentionally keeps capture simple.
- Provenance, verification, and revision context belong with important information.

## Platform

- `DesignNerd-MTG/TIKI` is the canonical code repository.
- GitHub is the source of truth.
- Netlify is the deployment layer.
- `https://tiki.mtgdesigns.net` is the production domain target.
- The existing Supabase project named `TIKI` provides authentication, Postgres, and Row Level Security.
- The frontend is a portable Next.js App Router application written in TypeScript.
- Supabase email/password authentication proves identity for the current release.
- T.I.K.I. profiles separately control activation and role.
- Roles are viewer, contributor, editor, and admin.
- New authenticated people are inactive until an admin approves them.
- Google OAuth is an optional future enhancement, not a current setup dependency.

## Security

- RLS is the hard authorization barrier; hiding navigation is only an interface aid.
- Vendors / Clients requires editor or admin access.
- The browser receives only the Supabase URL and publishable key.
- Service-role keys, `sb_secret_...` keys, and database passwords never belong in the frontend or Netlify settings for this app.

## Deferred

- No AI assistant until the verified knowledge base is useful.
- No travel/flight or crew/Airtable module yet.
- No native mobile application; the responsive web portal comes first.
- No packet builder or automated manufacturer scraping yet.
- No Dropbox replacement; T.I.K.I. links to and indexes existing files.
- No sensitive vendor/client data until permissions have been tested with real accounts.
