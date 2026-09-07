# GitHub → Netlify → `tiki.mtgdesigns.net`

The canonical code is already in the private GitHub repository `DesignNerd-MTG/TIKI`. Netlify is the deployment layer; the existing Supabase project named `TIKI` provides authentication, data, and Row Level Security.

## 1. Connect Netlify to GitHub

1. Sign in to Netlify.
2. Choose **Add new project → Import an existing project**.
3. Choose GitHub and authorize access if asked.
4. Select `DesignNerd-MTG/TIKI`.
5. Keep the production branch set to `main`.

Netlify reads [`netlify.toml`](../netlify.toml):

- Build command: `npm run build`
- Publish directory: `.next`
- Node.js: `24.17.0`

Netlify detects Next.js and supplies its maintained OpenNext adapter automatically. No Vercel configuration or separately pinned Next.js plugin is required.

## 2. Add the Supabase environment variables

Before the first production deploy, open **Project configuration → Environment variables** in Netlify and add exactly these application values:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

Copy both from the Supabase `TIKI` project Connect dialog or API settings. Apply them to Production, Deploy Previews, and Branch Deploys, with scopes that include Builds. Using all available scopes is appropriate for this Next.js application.

Do not add a Supabase `service_role` key, `sb_secret_...` key, or database password. The frontend does not need them.

## 3. Deploy the Netlify site

Start the deploy. When it finishes, Netlify provides a default address similar to:

```text
https://YOUR_NETLIFY_SITE_NAME.netlify.app
```

Open that address and confirm the T.I.K.I. login page loads. Keep the actual Netlify site name; it is needed for DNS and optional preview redirects.

## 4. Add the production custom domain

DNS cannot be configured from this repository.

1. In Netlify, open **Domain management** for the T.I.K.I. site.
2. Choose **Add a domain** and add `tiki.mtgdesigns.net`.
3. At the DNS provider that manages `mtgdesigns.net`, create this record:

| Field | Value |
| --- | --- |
| Type | `CNAME` |
| Name / Host | `tiki` |
| Target / Value | `YOUR_NETLIFY_SITE_NAME.netlify.app` |

Use the real Netlify address, without `https://` and without a path. Netlify must know about the custom domain before the DNS record is added. DNS propagation and certificate issuance can take time.

## 5. Configure Supabase Auth URLs

After the custom domain exists, open **Supabase TIKI → Authentication → URL Configuration**.

Set **Site URL** to:

```text
https://tiki.mtgdesigns.net
```

Add these **Additional Redirect URLs**:

```text
http://localhost:3000/**
http://localhost:3001/**
https://tiki.mtgdesigns.net/**
```

If authentication links must work on Netlify Deploy Previews, also add:

```text
https://**--YOUR_NETLIFY_SITE_NAME.netlify.app/**
```

Replace `YOUR_NETLIFY_SITE_NAME` with the site’s actual Netlify name. Keep the exact custom-domain entry for production; use the wildcard only for changing preview subdomains.

These redirects are used by email confirmation and password recovery. If customized Supabase email templates ignore the requested redirect, check that the template uses Supabase’s redirect/confirmation variables rather than a hard-coded old URL.

## 6. Production readiness checks

- Email/password sign-up and sign-in work at `https://tiki.mtgdesigns.net`.
- A confirmation email, when enabled, returns to the custom domain.
- **Forgot password?** returns to `/reset-password` and allows a new password.
- A new account lands on Access Pending.
- An admin can activate that account and assign a role.
- A viewer cannot open `/vendors` or `/admin` by typing the URL.
- An editor can open Vendors / Clients but not Admin.
- An admin can manage profiles.
- Napkin notes remain limited by their RLS policies.
- No secrets are committed to GitHub or exposed in Netlify configuration.

## 7. Production and previews

The simplest first deployment uses the existing Supabase `TIKI` project for production and previews. Before sensitive vendor/client information is entered, consider a separate staging Supabase project and Netlify context-specific environment values so preview deployments cannot affect production data.
