# T.I.K.I.

**Technical Information & Knowledge Index** — the private production portal for the LDG Entertainment Division.

T.I.K.I. is the map, not the territory. It indexes existing systems such as Dropbox, MediaPulse, Airtable, ETC, and grandMA instead of replacing them.

## Current foundation

- Next.js App Router, React, and TypeScript
- Supabase email/password authentication with SSR cookie sessions
- Separate identity, activation, and role layers
- Viewer, contributor, editor, and admin roles
- Access Pending state for authenticated people who are not activated
- Supabase Row Level Security, including the restricted Vendors / Clients area
- Dashboard with live counts, recent updates, and role-aware quick actions
- Complete create, detail, edit, status, tag, revision, archive, and safe-delete workflows
- Global search across permitted content, Napkin notes, vendor/client context, and tags
- T.I.K.I. Napkin capture, assignment, conversion tracking, and triage statuses
- Admin activation and role controls with self-lockout protection
- Netlify configuration, Node.js `24.17.0`, and production-domain documentation
- Safe `/preview` route for viewing the interface before Supabase is connected

Intentionally deferred: file storage, Dropbox synchronization, Google OAuth, AI ingestion/assistant, custom SMTP, travel/flight tracking, crew/Airtable integration, native mobile apps, packet builder, and automated manufacturer scraping.

## Canonical project

- GitHub: `DesignNerd-MTG/TIKI`
- Local folder: `C:\Users\mtgde\OneDrive\Desktop\TIKI`
- Supabase project: `TIKI`
- Hosting: Netlify
- Production domain: `https://tiki.mtgdesigns.net`

## Run locally in PowerShell

```powershell
cd C:\Users\mtgde\OneDrive\Desktop\TIKI
npm.cmd install
npm.cmd run dev
```

Open the `Local` address printed by Next.js. It is normally `http://localhost:3000`; if that port is busy, Next.js may use `http://localhost:3001`.

Without valid Supabase values in `.env.local`, the app stays in setup mode and offers `/preview`. Follow [BEGINNER-SETUP.md](./BEGINNER-SETUP.md) to connect the existing Supabase project.

## Quality checks

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

## Security model

Supabase email/password authentication answers: “Who is this person?”

The `public.profiles` table answers: “May this person enter T.I.K.I., and what may they do?”

Creating an account automatically creates an **inactive viewer** profile. The person remains on `/pending` until an administrator activates the profile and assigns the appropriate role. Interface checks improve navigation, while Supabase Row Level Security is the hard access barrier.

The frontend uses only:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never add a Supabase `service_role` key, `sb_secret_...` key, or database password to this application, GitHub, or Netlify.

## Repository layout

```text
src/app/                 Pages, route handlers, and portal modules
src/components/          Shared interface and authentication components
src/lib/                 Authorization, Supabase clients, and utilities
tests/                   Lightweight role-policy checks
supabase/migrations/     Database schema and Row Level Security
docs/                    Environment and deployment instructions
netlify.toml             Netlify build configuration
```

Deployment path: **local development → GitHub → Netlify → Supabase**.

See [docs/CONTENT-MANAGEMENT.md](./docs/CONTENT-MANAGEMENT.md), [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md), and [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
