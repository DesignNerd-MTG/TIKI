# T.I.K.I. beginner setup

This is the shortest route from “downloaded code” to “Mike can sign in.” Do the sections in order.

## Part A — See the interface locally

Open a terminal in this folder and run:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Because Supabase is not connected yet, the Google button is disabled. Choose **Preview the portal first** to inspect the interface.

Stop the development server with `Ctrl+C`.

## Part B — Create Supabase

1. Create a new Supabase project.
2. Open **SQL Editor**.
3. Open `supabase/migrations/202609060001_initial_tiki.sql` from this project.
4. Copy the whole file into the SQL Editor and run it once.
5. In Supabase, open the project Connect dialog or API settings.
6. Copy the **Project URL** and **Publishable key**.

In the project folder, run:

```bash
copy .env.example .env.local
```

Open `.env.local` and replace the two placeholders. Restart `npm run dev` after changing environment values.

## Part C — Configure Google login

There are two callbacks in this flow, and they belong in different places.

### In Google Cloud / Google Auth Platform

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen and audience.
3. Create an OAuth client of type **Web application**.
4. Add `http://localhost:3000` as an authorized JavaScript origin for local work.
5. Add the Supabase callback shown on Supabase’s Google provider page as the authorized redirect URI. It looks like:

```text
https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
```

6. Copy the Google Client ID and Client Secret.

### In Supabase

1. Open **Authentication → Sign In / Providers → Google**.
2. Enable Google.
3. Paste the Google Client ID and Client Secret, then save.
4. Open **Authentication → URL Configuration**.
5. For local development, add `http://localhost:3000/**` to the redirect allow list.

Now run `npm run dev`, open `http://localhost:3000`, and choose **Continue with Google**.

## Part D — Activate the first administrator

The first successful Google sign-in intentionally lands on **Access Pending**. The database created an inactive profile; nobody gets access merely because Google knows them.

Open the Supabase SQL Editor and run this once, replacing the email:

```sql
update public.profiles
set active = true, role = 'admin'
where email = 'YOUR_GOOGLE_EMAIL';
```

Return to the pending page and choose **Check again**. You should reach the dashboard and see Admin in the navigation.

From then on, use **Admin → People & access** to activate other people and assign roles.

## Part E — Understand the roles

- **Viewer:** reads verified/published knowledge and can capture personal Napkin notes.
- **Contributor:** also submits draft content as the editing forms are added.
- **Editor:** reviews and publishes content, triages Napkin notes, and enters the restricted Vendors / Clients area.
- **Admin:** also activates users, changes roles, and performs destructive management actions.

## Part F — Put it in GitHub and Netlify

Use [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md). The important sequence is:

1. Create a private GitHub repository.
2. Push this folder.
3. Import that repository into Netlify.
4. Add the two Supabase environment variables in Netlify.
5. Add the Netlify production and preview URLs to Supabase’s redirect allow list.

## Part G — Verify the foundation

Run these before every important push:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four should finish without errors.

## First useful content pass

After login and roles are proven with at least two real accounts:

1. Add the 10–20 fixtures the team actually searches for.
2. Add the daily Link Hub destinations.
3. Index a few current show folders.
4. Use T.I.K.I. Napkin in real life for a week.
5. Do not enter sensitive vendor/client notes until the editor restriction has been tested directly.
