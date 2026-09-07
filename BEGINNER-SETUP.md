# T.I.K.I. beginner setup

This is the current command-by-command path for Mike. The GitHub repository, local project folder, Supabase `TIKI` project, and initial database migration already exist.

## Part A — Start T.I.K.I. locally

Open PowerShell and run:

```powershell
cd C:\Users\mtgde\OneDrive\Desktop\TIKI
npm.cmd install
npm.cmd run dev
```

Use the `Local` address shown in PowerShell. It will normally be:

```text
http://localhost:3000
```

If port 3000 is already busy, Next.js may automatically use:

```text
http://localhost:3001
```

Keep that PowerShell window open while using T.I.K.I. Stop the server later with `Ctrl+C`.

If Supabase is not connected yet, the login page displays **Setup mode**. Use **Preview the portal first** to inspect the interface without database access.

## Part B — Connect the existing Supabase project

The Supabase project is already named **TIKI**, and `supabase/migrations/202609060001_initial_tiki.sql` has already been run successfully. Do not run the initial migration a second time.

For the content-management MVP, run `supabase/migrations/202609070001_content_management_mvp.sql` and then `supabase/migrations/202609070002_site_appearance.sql` once each in the Supabase SQL Editor. They preserve existing content rows, add supporting indexes and helper functions, tighten RLS so Contributors cannot self-publish, and create the single global appearance-settings row. Both files are transactional: an error rolls back the whole migration.

1. Open the Supabase `TIKI` project.
2. Open the project **Connect** dialog or **Project Settings → API Keys**.
3. Copy the **Project URL**.
4. Copy the browser-safe **Publishable key**, which begins with `sb_publishable_`.
5. Stop the local server with `Ctrl+C` if it is running.
6. In PowerShell, create the local environment file:

```powershell
cd C:\Users\mtgde\OneDrive\Desktop\TIKI
Copy-Item .env.example .env.local
notepad .env.local
```

If `.env.local` already exists, skip the `Copy-Item` command and only open it with Notepad.

Replace the placeholders with the two values from Supabase:

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_VALUE
```

Save the file, close Notepad, and restart T.I.K.I.:

```powershell
npm.cmd run dev
```

Do not place a `service_role` key, an `sb_secret_...` key, or the database password in `.env.local`.

## Part C — Enable email/password authentication

1. In Supabase, open **Authentication → Providers**.
2. Open the **Email** provider.
3. Make sure email/password sign-in is enabled.
4. Save the provider settings if you changed them.

For quick local testing, you may temporarily turn off **Confirm email**. With confirmation off, a new account signs in immediately and moves to Access Pending.

Before real team or production use, reconsider that choice. With confirmation enabled, users must click the confirmation email before signing in. Confirmation and password-reset email delivery should also be tested, and production use should have suitable SMTP/email delivery settings.

Google Cloud Console setup is not required. Google OAuth is only a possible future enhancement.

## Part D — Configure Supabase redirect URLs

In Supabase, open **Authentication → URL Configuration**.

During local testing, add these **Additional Redirect URLs**:

```text
http://localhost:3000/**
http://localhost:3001/**
```

The final production configuration is documented in [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). Redirect URLs are still required for account-confirmation and password-reset links even though sign-in itself uses email/password.

## Part E — Create and activate the first administrator

1. Open the T.I.K.I. login page.
2. Choose **Create account**.
3. Enter your email and a password of at least 8 characters.
4. If email confirmation is enabled, open the confirmation email and follow its link.
5. Sign in.

The account should land on **Access Pending**. That is correct: authentication proves identity but does not grant department access.

To activate the first administrator, open the Supabase SQL Editor and run the following once, replacing the email address:

```sql
update public.profiles
set active = true, role = 'admin'
where email = 'YOUR_EMAIL_ADDRESS';
```

Return to T.I.K.I. and choose **Check again**. The dashboard and Admin navigation should appear.

After the first admin exists, use **Admin → People & access** to activate other profiles and assign roles. The **Appearance** section on the same page changes the curated, site-wide T.I.K.I. theme; RLS allows only Admins to update it.

## Part F — Understand the roles

- **Viewer:** reads verified/published knowledge and captures, edits, or archives personal raw Napkin notes.
- **Contributor:** also creates drafts, edits their own working records, and submits them for review.
- **Editor:** reviews all content, changes publication status, triages Napkin notes, and manages Vendors / Clients.
- **Admin:** also activates people, changes roles, and permanently deletes records after they are archived.

No authenticated person sees portal content until their profile is active. Supabase Row Level Security remains the hard guardrail even if someone manually types a restricted URL.

## Part G — Test the account flow

Check all of these before deployment:

1. Create a second test account.
2. Confirm that it lands on **Access Pending**.
3. Use the first admin account to activate it as a viewer.
4. Confirm that the viewer can open normal modules.
5. Confirm that the viewer cannot open `/vendors` or `/admin` by typing those URLs.
6. On the login page, choose **Forgot password?** and confirm the reset email returns to T.I.K.I.
7. Save a note in **T.I.K.I. Napkin**.
8. As a Contributor, create a clearly labeled test draft and submit it; confirm publishing is unavailable.
9. As an Editor, verify or publish the test record, then archive it.
10. As an Admin, permanently delete only that archived test record.

## Part H — Run project checks

Stop the development server with `Ctrl+C`, then run:

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

All four commands should finish without errors.

## Part I — Deploy

Follow [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). The short version is:

1. Connect Netlify to `DesignNerd-MTG/TIKI`.
2. Add the two public Supabase environment variables.
3. Deploy.
4. Add `tiki.mtgdesigns.net` to Netlify.
5. Create the `tiki` CNAME at the DNS provider.
6. Update Supabase Auth URL Configuration.

After access is proven with at least two accounts, add a small set of fixtures, daily links, and current show folders. Use T.I.K.I. Napkin in real work before expanding the product surface.
