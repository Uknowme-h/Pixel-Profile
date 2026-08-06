# Pixel Profile Builder (GitHub README Generator)

Live-updating pixel-art GitHub profile cards you embed in your README. Backed by a
serverless free-tier stack — no billing, nothing self-hosted for v1.

## Stack

- **Next.js (App Router) on Vercel** — builder UI + `/api/render` SVG endpoint.
- **Supabase** — Postgres (configs + derived data cache), Storage (mascot SVGs),
  Auth (GitHub OAuth).
- **GitHub GraphQL** — single query for profile, contribution total, top
  languages, pinned repos, via a GitHub App installation token.
- **GitHub Actions `schedule:` workflow** — background refresh (Vercel Cron is
  Pro-only; Actions is free, no function timeout, and its DB writes keep the
  Supabase project awake).
- No dedicated cache layer for v1: Postgres `fetched_at` staleness + HTTP cache
  headers cover the load.

Full design rationale in [`Project_Plan.md`](./Project_Plan.md).

## How it works

```
[README] --<img src="...svg?v={config_hash}">--> camo --> GET /api/render/{user}/{tpl}.svg
                                                          |-> Postgres (config + derived data)
                                                          |-> render(template_id, data) -> SVG
   also, GitHub Actions cron -> refresh stale profiles into Postgres
```

Cache-busting is done by versioning the **URL** (`?v=hash`), not the header,
because camo caches by URL and the README HTML is cached too.

## Getting started (local)

1. `npm install`
2. Copy `.env.example` → `.env.local` and fill in **Supabase** project keys.
3. `npm run dev` → open http://localhost:3000.

The builder shows a "Supabase not configured" notice until env vars are set;
the shipped routes are validation-safe without them.

## Setup required before production use

1. **Supabase**: run `supabase/schema.sql` in the SQL editor. Create the
   `mascots` public bucket (the upload route creates it on demand).
2. **GitHub App**: create one at GitHub → Settings → Developer settings. Set
   `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (raw/blob with `\n`), and install
   it on target accounts. Store env vars in Vercel.
3. **Refresh cron**: `.github/workflows/refresh.yml` runs every 30 min. Set the
   same secrets under repo → Settings → Secrets and variables → Actions
   (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GITHUB_APP_ID`,
   `GITHUB_APP_PRIVATE_KEY`).
4. **Register the GitHub Developer Program** (Phase 9) — earns the badge and
   confirms API eligibility. Confirm current terms at docs.github.com.

## Scripts

| Command              | Purpose                                        |
| -------------------- | ---------------------------------------------- |
| `npm run dev`        | Local dev server                               |
| `npm run build`      | Production build                               |
| `npm run lint`       | ESLint                                         |
| `npm run typecheck`  | `tsc --noEmit`                                 |
| `npm test`           | Vitest suite (pixel-font, templates, sanitize, GitHub client) |
| `npm run refresh`    | Run the background refresh against Supabase + GitHub (used by CI cron) |

## Testing gate (Phase 8)

- Pixel-font golden tests (one shifted pixel = broken art).
- Template render snapshots across both v1 templates.
- Sanitizer XSS corpus (scripts, `on*`, `<foreignObject>`, external refs,
  entity bombs) asserting **hard rejection**, never silent strip.
- GitHub API client stubbed so the suite never burns real rate limits.

## API

- `GET /api/render/{username}/{templateId}.svg?v={hash}` — the badge URL.
- `POST /api/upload/user/{username}` — sanitize + store a mascot SVG.
- `POST /api/config` — save the caller's card config (or upsert).

## Roadmap

See `Project_Plan.md` Phases 1–11 for the full plan, free-tier constraints, and
post-launch expansion options (more templates, community gallery, aggregate
analytics).