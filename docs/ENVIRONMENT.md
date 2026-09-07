# Environment variables

T.I.K.I. currently uses only the browser-safe public values from the existing Supabase project named `TIKI`.

| Variable | Where to find it | Browser-safe? | Used by |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Connect dialog / API settings | Yes | Browser and server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase Connect dialog / API settings | Yes | Browser and server |

The names above are the names used by the code, `.env.example`, local setup, and Netlify. Do not substitute `NEXT_PUBLIC_SUPABASE_ANON_KEY` unless the entire application is intentionally migrated later.

## Local development

In PowerShell:

```powershell
cd C:\Users\mtgde\OneDrive\Desktop\TIKI
Copy-Item .env.example .env.local
notepad .env.local
```

If `.env.local` already exists, do not overwrite it; open the existing file instead. Restart `npm.cmd run dev` after changing environment values.

`.env.local` is ignored by Git and must stay uncommitted.

## Netlify

In the Netlify site, open **Project configuration → Environment variables** and create the same two variables. Apply them to the desired deploy contexts and include the Build scope. Netlify does not read the `.env.local` file on Mike’s computer.

## Values that must never be added

Do not place any of the following in `.env.local`, GitHub, `netlify.toml`, or Netlify environment variables for this frontend:

- Supabase `service_role` key
- Supabase `sb_secret_...` key
- Supabase database password

The publishable key is intentionally available to the browser. Supabase Row Level Security determines what the authenticated person can read or change.
