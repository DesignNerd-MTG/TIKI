# GitHub → Netlify deployment

## 1. Put the project in GitHub

Create an empty private GitHub repository, then run the commands GitHub shows for an existing local repository. A typical first push looks like:

```bash
git init
git add .
git commit -m "Build initial T.I.K.I. foundation"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 2. Import it into Netlify

1. In Netlify, choose **Add new project → Import an existing project**.
2. Choose GitHub and select the private T.I.K.I. repository.
3. Netlify reads `netlify.toml`; the build command is `npm run build` and the publish directory is `.next`.
4. Add both Supabase variables before the first production deploy.
5. Deploy the site.

The pinned Node version is `24.17.0` in both `.nvmrc` and `netlify.toml`.

## 3. Allow the Netlify URLs in Supabase

In **Supabase → Authentication → URL Configuration**:

- Set **Site URL** to the final production address, such as `https://your-tiki-site.netlify.app`.
- Add `http://localhost:3000/**` for local development.
- Add `https://your-tiki-site.netlify.app/**` as an exact production redirect.
- Add `https://**--your-tiki-site.netlify.app/**` if deploy previews need working Google sign-in.

Supabase recommends exact production redirects. The wildcard is only for Netlify’s changing preview subdomains.

## 4. Production/staging distinction

The simplest first setup uses one Supabase project and enables OAuth on production plus preview URLs. Before real sensitive vendor/client content is entered, create a separate staging Supabase project and use Netlify’s context-specific environment values so preview deployments never touch production data.

## 5. Deployment checks

- Google login returns to `/auth/callback` on the deployed site.
- A brand-new user lands on Access Pending.
- A viewer cannot open `/vendors` or `/admin` by typing the URL.
- An editor can open Vendors / Clients but not Admin.
- An admin can activate users and change roles.
- Napkin notes are visible only to their author and editors/admins.
