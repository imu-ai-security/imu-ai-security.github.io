# Setup & deployment

Step-by-step to get your own copy live. Most of the *content* work is faster with Claude — see
**[CLAUDE.md](./CLAUDE.md)**. This file covers the parts you do yourself (GitHub + domain + secrets).

## 0. Prerequisites

- **Node 20+** and npm.
- A **GitHub account**.
- (Optional) A **custom domain** and access to its DNS.
- (Optional, for live citation counts) a **[SerpAPI](https://serpapi.com)** account (free tier is plenty).

## 1. Create your repo from this template

On GitHub, click **“Use this template” → “Create a new repository.”** (Or clone, then
`git remote set-url origin <your repo>`.) Then locally:

```bash
git clone https://github.com/<you>/<your-repo>.git
cd <your-repo>
npm install
npm run dev          # http://localhost:4321
```

## 2. Customize

Edit `src/data/site.ts` first (lab name, PI, institution, contact, social, nav). Then replace the
placeholder content in `src/content/` and the favicon in `public/`. The guided way is **Claude** —
open **[CLAUDE.md](./CLAUDE.md)** and follow it.

Verify a clean build before deploying:

```bash
npm run build
```

## 3. Deploy to GitHub Pages

This template deploys via **GitHub Actions** (`.github/workflows/deploy.yml`), which builds Astro and
publishes on every push to your default branch.

1. Push your changes to the default branch (`main` or `master`).
2. In your repo: **Settings → Pages → Build and deployment → Source → “GitHub Actions.”**
   **⚠️ This step is required** — if Source is left on “Deploy from a branch,” Pages will try to
   serve raw source files and the site won’t work.
3. Push again (or re-run the **Deploy to GitHub Pages** workflow from the **Actions** tab). When it
   goes green, your site is live at `https://<you>.github.io/<repo>/` (or your custom domain).

## 4. Custom domain (optional but recommended)

**With a custom domain** (e.g. `lab.example.edu`):

1. Put the bare host in **`public/CNAME`** (one line, no `https://`), e.g. `lab.example.edu`.
2. Set `site: 'https://lab.example.edu'` in **`astro.config.mjs`** (leave `base` unset).
3. In **Settings → Pages → Custom domain**, enter the domain and save; enable **Enforce HTTPS**.
4. Add the DNS records GitHub asks for (a `CNAME` record for a subdomain, or apex `A`/`ALIAS`
   records). See GitHub’s “Managing a custom domain for your GitHub Pages site.”

**Without a custom domain** (project page at `username.github.io/repo`):

- Delete `public/CNAME`.
- In `astro.config.mjs` set `site: 'https://<you>.github.io'` and `base: '/<repo>'`.

## 5. Weekly citation counts (optional)

`.github/workflows/refresh-citations.yml` updates per-paper Google Scholar counts every Monday (and
on demand). It’s a **no-op until you add credentials**, so it’s safe to ignore.

To enable it, in **Settings → Secrets and variables → Actions**:

- Add a **secret** named `SERPAPI_KEY` = your SerpAPI private key.
- Add a **variable** named `SCHOLAR_AUTHOR_ID` = your Google Scholar profile id (the `user=…` value
  in your Scholar profile URL).

Then run **Actions → Refresh Scholar citations → Run workflow** to test it. It matches your papers
to your Scholar profile by title and writes `citations:`/`scholarUrl:` into each publication file.

## 6. Keep it updated

- **New papers / people / photos:** add Markdown files under `src/content/…` (Claude can do this).
- **Anything you push to the default branch redeploys automatically.**
- The figures gallery only shows entries with `rightsConfirmed: true` — keep that honest.
