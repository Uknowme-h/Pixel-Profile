import { getInstallationToken, clearTokenCache } from "@/lib/github/app";
import type { GithubStatus } from "@/types";

/**
 * Phase 3 — GitHub API integration layer.
 *
 * Single GraphQL query pulls profile + calendar + languages + pinned repos in
 * one call (avoids many REST calls; no ETag on GraphQL so we cache ourselves —
 * see store.ts). This module is the single choke point for rate-limit
 * budgeting + backoff.
 */

const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";

export interface ProfileQueryResult {
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  totalContributions: number;
  commits: number;
  pullRequests: number;
  issues: number;
  reposContributed: number;
  languages: Record<string, number>;
  pinnedRepos: { name: string; description: string | null; stars: number }[];
  starredRepos: number;
}

const PROFILE_QUERY = /* GraphQL */ `
  query Profile($login: String!) {
    user(login: $login) {
      login
      name
      bio
      avatarUrl
      contributionsCollection {
        totalCommitContributions
        totalPullRequestContributions
        totalIssueContributions
        totalRepositoriesWithContributedCommits
      }
      repositories(first: 10, orderBy: {field: STARGAZERS, direction: DESC}) {
        nodes {
          name
          stargazerCount
          languages(first: 5, orderBy: {field: SIZE, direction: DESC}) {
            edges { size node { name } }
          }
        }
      }
      pinnedItems(first: 3, types: REPOSITORY) {
        nodes {
          ... on Repository { name description stargazerCount }
        }
      }
    }
  }
`;

export const QUERY_HASH = "profile-v1";

interface ProfileNode {
  login: string;
  name: string | null;
  bio: string | null;
  avatarUrl: string | null;
  contributionsCollection: {
    totalCommitContributions: number;
    totalPullRequestContributions: number;
    totalIssueContributions: number;
    totalRepositoriesWithContributedCommits: number;
  };
  repositories: {
    nodes: {
      name: string;
      stargazerCount: number;
      languages: { edges: { size: number; node: { name: string } }[] };
    }[];
  };
  pinnedItems: { nodes: { name: string; description: string | null; stargazerCount: number }[] };
}

interface ProfileResponse {
  data?: { user?: ProfileNode | null };
  errors?: { type?: string; message?: string }[];
}

export class GithubApiError extends Error {
  status: number;
  type?: string;
  constructor(message: string, status: number, type?: string) {
    super(message);
    this.status = status;
    this.type = type;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class GithubApiClient {
  private budget = { limit: Infinity, remaining: Infinity, resetAt: 0 };
  private backoffMs = 0;

  constructor(private readonly token: string) {}

  private readRateLimit(res: Response): void {
    const remaining = Number(res.headers.get("x-ratelimit-remaining"));
    const limit = Number(res.headers.get("x-ratelimit-limit"));
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    if (Number.isFinite(limit) && Number.isFinite(remaining)) {
      this.budget = { limit, remaining, resetAt: Number.isFinite(reset) ? reset * 1000 : 0 };
    }
  }

  private async enforceBudget(): Promise<void> {
    if (this.budget.remaining <= 0) {
      const wait = Math.min(Math.max(this.budget.resetAt - Date.now(), 1000), 60_000);
      await sleep(wait);
    }
  }

  private async enforceBackoff(): Promise<void> {
    if (this.backoffMs > 0) await sleep(this.backoffMs);
  }

  /** Fetch a full profile for one username. Throws GithubApiError (404 if gone). */
  async fetchProfile(username: string): Promise<ProfileQueryResult> {
    await this.enforceBudget();
    await this.enforceBackoff();

    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: PROFILE_QUERY, variables: { login: username } }),
    });

    this.readRateLimit(res);
    let body: ProfileResponse = {};
    try {
      body = (await res.json()) as ProfileResponse;
    } catch {
      // Non-JSON body (e.g. a plain-text 403/429 from a proxy) — still treat
      // as an error below.
    }

    if (!res.ok || body.errors) {
      const type = body.errors?.[0]?.type;
      if (res.status === 403 || type === "RATE_LIMITED") {
        this.backoffMs = this.backoffMs === 0 ? 2_000 : Math.min(this.backoffMs * 2, 60_000);
      }
      throw new GithubApiError(body.errors?.[0]?.message ?? `HTTP ${res.status}`, res.status, type);
    }

    this.backoffMs = 0;
    const user = body.data?.user ?? null;
    if (!user) throw new GithubApiError(`GitHub user not found: ${username}`, 404, "NOT_FOUND");

    const contributions = user.contributionsCollection ?? {};
    const languages: Record<string, number> = {};
    const pinnedRepos: ProfileQueryResult["pinnedRepos"] = [];
    let starredTotal = 0;

    for (const repo of user.repositories?.nodes ?? []) {
      starredTotal += repo.stargazerCount ?? 0;
      for (const edge of repo.languages?.edges ?? []) {
        languages[edge.node.name] = (languages[edge.node.name] ?? 0) + edge.size;
      }
    }

    for (const repo of user.pinnedItems?.nodes ?? []) {
      pinnedRepos.push({ name: repo.name, description: repo.description ?? null, stars: repo.stargazerCount ?? 0 });
    }

    const commits = contributions.totalCommitContributions ?? 0;
    const pullRequests = contributions.totalPullRequestContributions ?? 0;
    const issues = contributions.totalIssueContributions ?? 0;
    const reposContributed = contributions.totalRepositoriesWithContributedCommits ?? 0;

    return {
      login: user.login,
      name: user.name ?? null,
      bio: user.bio ?? null,
      avatarUrl: user.avatarUrl ?? null,
      totalContributions: commits + pullRequests + issues + reposContributed,
      commits,
      pullRequests,
      issues,
      reposContributed,
      languages: Object.entries(languages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .reduce<Record<string, number>>((acc, [k, v]) => ((acc[k] = v), acc), {}),
      pinnedRepos,
      starredRepos: starredTotal,
    };
  }
}

export async function fetchProfileWithStatus(username: string): Promise<{
  result: ProfileQueryResult | null;
  status: GithubStatus;
}> {
  try {
    const token = await getInstallationToken();
    const client = new GithubApiClient(token);
    const result = await client.fetchProfile(username);
    return { result, status: "ok" };
  } catch (err) {
    if (err instanceof GithubApiError) {
      if (err.status === 404) return { result: null, status: "not_found" };
      if (err.status === 401) {
        // Re-mint token and retry once (cleaner than app-level cache reuse).
        clearTokenCache();
        try {
          const token = await getInstallationToken();
          const client = new GithubApiClient(token);
          const result = await client.fetchProfile(username);
          return { result, status: "ok" };
        } catch (retryErr) {
          if (retryErr instanceof GithubApiError && retryErr.status === 404) {
            return { result: null, status: "not_found" };
          }
          throw retryErr;
        }
      }
    }
    throw err;
  }
}

// Minimal token cache shared with app.ts via this module boundary.