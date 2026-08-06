# Creating the GitHub App

The render endpoint fetches profile data using a GitHub **App** installation
token (`src/lib/github/app.ts`). This guide walks through creating it and
storing the three values the code reads:


| Env var                     | Source in GitHub UI                                       | Shared with refresh cron? |
| --------------------------- | --------------------------------------------------------- | ------------------------- |
| `GITHUB_APP_ID`             | App page → "App ID" (top of General tab)                  | Yes                       |
| `GITHUB_APP_PRIVATE_KEY`    | "Generate a private key" → downloaded `.pem`              | Yes                       |
| `GITHUB_APP_WEBHOOK_SECRET` | Optional; "Webhook secret" (only if you enable a webhook) | Yes                       |


> The app also uses Supabase + GitHub OAuth for the builder login, but that is
> a **separate** OAuth App via Supabase Auth provider — not this GitHub App.



## Why install on the dev account

The v1 refresh assumes a **single installation** (multiple installations fall
back to the first — `src/lib/github/app.ts:63`). Install the app on the account
whose profiles you want to render.

## 1. Register the GitHub App

1. GitHub → top-right avatar → **Settings**.
2. Left sidebar → **Developer settings** → **GitHub Apps** → **New GitHub App**.
3. Fill in:
  - **GitHub App name** — e.g. `pixel-profile-bot` (must be unique-ish).
  - **Homepage URL** — any; use `https://github.com` if you don't have a site yet.
  - **Description** — optional.
  - **Webhook URL / Active** — you can leave **Webhook disabled** (the code
  never receives webhooks). If you enable it, set a `GITHUB_APP_WEBHOOK_SECRET`.
4. **Permissions** — this is the important part. The app only reads **public**
  profile data, so Minimal:
  - **Metadata → Read** (mandatory for GitHub Apps).
  - Everything else can stay at "no access" for a read-only profile renderer.
5. **Where can this GitHub App be installed?** → **Only on this account**
  (keeps the single-installation assumption true).
6. Click **Create GitHub App**.



## 2. Capture App ID + private key

On the app's page after creation:

1. **App ID** — copy the large ID at the top of the **General** tab → this is
  `GITHUB_APP_ID`.
2. Scroll to **Private keys** → **Generate a private key** → downloads
  `pixel-profile-bot.2026-xx-xx.private-key.pem`.
3. Store that PEM **as a single-line secret** with literal `\n` for newlines.
  The code normalizes them: `replace(/\\n/g, "\n")` (`app.ts:33`). Vercel and
   GitHub Actions both accept pasting the key on one line.
   Example value format:



## 3. Install the app

1. On the app page → **Install App** (left) → **Install** the repository/account.
2. Choose **All repositories** or selected ones. For public-profile rendering,
  the account install alone is enough — repos aren't required for the GraphQL
   profile/contributions query.



## 4. Store the secrets

Add the values to **every** env context the code runs in:

- **Vercel** → project → Settings → Environment Variables:
`GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET` (optional).
- **Vercel edge/function** scope works; server-only is fine.
- **GitHub Actions** (for the refresh cron) → repo **Settings → Secrets and
variables → Actions**: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`,
`GITHUB_APP_WEBHOOK_SECRET`.



## 5. Verify

```bash
# From the repo root (requires the env vars + a signed-in Supabase ctx):
npm run dev
curl "http://localhost:3000/api/render/<your-github-username>/pixel.svg"
```

If it returns an SVG, the App JWT → `/app/installations` → access-token minting
chain worked. A JSON error like `failed to mint installation token: 401`
usually means the **private key didn't parse** (wrong `\n`) or the **App ID**
is wrong; `404` on `/app/installations` means the app isn't installed yet.

## Troubleshooting


| Symptom                                    | Likely cause                                                      |
| ------------------------------------------ | ----------------------------------------------------------------- |
| `missing env var: GITHUB_APP_ID`           | Env not set for the running context (Vercel vs local vs Actions). |
| `failed to list installations: 401`        | Private key format broken (or App ID wrong).                      |
| `failed to list installations: 404`        | App not installed, or wrong account.                              |
| `failed to mint installation token: 401`   | JWT expired within the request window / clock skew — retry.       |
| Multiple-install fallback picks wrong user | v1 assumption; install on one account only.                       |


[![Uknowme-h profile card](http://localhost:3000/api/render/Uknowme-h/arcade.svg?v=1e3c5579d0e2)]

