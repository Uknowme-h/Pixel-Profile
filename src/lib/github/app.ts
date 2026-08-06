import jwt from "jsonwebtoken";

/**
 * Phase 3 — GitHub App authentication.
 *
 * Two distinct tokens (never conflate):
 *  - Supabase Auth's GitHub OAuth token = the logged-in USER's own data.
 *  - The GitHub App installation token below = ALL app-level profile fetches.
 * Installation tokens expire after ~1h; we cache the minted token in a module
 * var instead of re-minting per call.
 */

const API_BASE = "https://api.github.com";
const TOKEN_TTL_SECONDS = 55 * 60; // refresh 5 min before expiry

interface TokenCache {
  installationId: string;
  token: string;
  expiresAt: number;
}

let cached: TokenCache | null = null;

function envOrThrow(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing env var: ${name}`);
  return v;
}

/** Mint a JWT signed by the App private key (valid 10 min, but we use ~9). */
export function createAppJwt(): string {
  const appId = envOrThrow("GITHUB_APP_ID");
  const privateKey = envOrThrow("GITHUB_APP_PRIVATE_KEY").replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iat: now,
      exp: now + 9 * 60,
      iss: appId,
    },
    privateKey,
    { algorithm: "RS256" }
  );
}

/** Resolve the installation ID for a target username (per GitHub App docs). */
export async function resolveInstallationId(username?: string): Promise<string> {
  // Prefer the app's single-installation flow: if the app is installed on a
  // user/org, GitHub gives us the installation id. For the v1 tool we query
  // the account-level installation via the /app/installations endpoint.
  const res = await fetch(`${API_BASE}/app/installations`, {
    headers: {
      Authorization: `Bearer ${createAppJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`failed to list installations: ${res.status} ${await res.text()}`);
  }
  const installs = (await res.json()) as { id: number }[];
  if (installs.length === 0) throw new Error("GitHub App has no installations");
  if (installs.length === 1) return String(installs[0].id);

  // Multiple installations: if a username was given, find a match (we can't
  // reliably, so fall back to the first). v1 assumes a single installation.
  void username;
  return String(installs[0].id);
}

/** Get (and cache) an installation access token for the app. */
export async function getInstallationToken(username?: string): Promise<string> {
  const installationId = await resolveInstallationId(username);
  if (cached && cached.installationId === installationId && Date.now() < cached.expiresAt) {
    return cached.token;
  }
  const res = await fetch(`${API_BASE}/app/installations/${installationId}/access_tokens`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${createAppJwt()}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!res.ok) {
    throw new Error(`failed to mint installation token: ${res.status} ${await res.text()}`);
  }
  const body = (await res.json()) as { token: string; expires_at: string };
  cached = {
    installationId,
    token: body.token,
    expiresAt: Date.now() + TOKEN_TTL_SECONDS * 1000,
  };
  return body.token;
}

export { API_BASE };

/** Clear the cached installation token (force re-mint on next call). */
export function clearTokenCache(): void {
  cached = null;
}
