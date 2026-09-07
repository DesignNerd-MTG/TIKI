# Environment variables

T.I.K.I. uses only the browser-safe Supabase project values at this stage.

| Variable | Where to find it | Secret? | Used where |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project Connect dialog / API settings | No | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project Connect dialog / API settings | No | Browser and server |

## Local development

Copy `.env.example` to `.env.local`, then replace both placeholder values.

```bash
copy .env.example .env.local
```

`.env.local` is ignored by Git. Do not commit it.

## Netlify

In the Netlify site, open **Project configuration → Environment variables** and create both variables. Apply them to Production, Deploy Previews, and Branch Deploys. Their scopes must include Builds; selecting all available scopes is also appropriate for this Next.js app.

Netlify does not use the repository’s local `.env.local` file. Values must be entered in Netlify itself.

## Key safety

The publishable key is intentionally exposed to the browser. Supabase Row Level Security limits what it can do for the signed-in user.

Do not add `SUPABASE_SERVICE_ROLE_KEY` to this application. A service-role key bypasses Row Level Security and is not needed for the current foundation.
