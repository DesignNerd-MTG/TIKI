# T.I.K.I.

**Technical Information & Knowledge Index** — a private production portal for the LDG Entertainment Division.

T.I.K.I. is the map, not the territory. It points to existing working systems, adds LDG-specific context, and makes verified production knowledge easy to retrieve.

## What this foundation includes

- Next.js App Router, React, and TypeScript
- Supabase cookie-based authentication and Google OAuth
- Separate identity and authorization layers
- Viewer, contributor, editor, and admin roles
- Access-pending state for signed-in users who are not activated
- Row Level Security policies, including the restricted Vendors / Clients area
- Dashboard and global search shell
- Fixtures list and answer-first fixture detail pages
- Shows, Link Hub, Documents, Vendors / Clients, Admin, and T.I.K.I. Napkin modules
- Working Napkin capture form and admin user activation controls
- Netlify configuration and pinned Node.js version
- A safe sample preview before Supabase is connected

Intentionally excluded for now: AI assistant, travel, crew, native mobile, and attempts to replace Dropbox or other working systems.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without real Supabase values, the app opens in setup mode and provides a portal preview.

For the complete click-by-click setup, use [BEGINNER-SETUP.md](./BEGINNER-SETUP.md).

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Repository layout

```text
src/app/                 Pages, route handlers, and portal modules
src/components/          Shared interface components
src/lib/                 Authorization, Supabase clients, and utilities
tests/                   Lightweight role-policy checks
supabase/migrations/     Database schema and Row Level Security
docs/                    Environment and deployment notes
netlify.toml             Netlify build configuration
```

## Security model

Google and Supabase Auth answer: “Who is this person?”

The `public.profiles` table answers: “May this person enter T.I.K.I., and what may they do?”

New Google users receive an inactive viewer profile automatically. They remain on `/pending` until an admin activates them. The interface hides restricted modules, but Supabase Row Level Security is the actual access barrier.

Never put a Supabase service-role key in this app or in a `NEXT_PUBLIC_` environment variable.

## Deployment path

```text
Local development → GitHub → Netlify → Supabase
```

Netlify detects modern Next.js automatically and supplies its maintained OpenNext adapter. The repository intentionally does not pin a separate Netlify Next.js plugin.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) and [docs/ENVIRONMENT.md](./docs/ENVIRONMENT.md).
