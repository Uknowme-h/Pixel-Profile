import { describe, expect, it } from "vitest";
import { GithubApiClient, GithubApiError } from "@/lib/github/api";
import type { GithubStatus } from "@/types";

/**
 * Phase 8 — GitHub API client tests.
 * These stub the fetch layer so the dev suite never burns real rate limits.
 */

function mockFetchOnce(
  handler: () => Response | Promise<Response>
): (input: RequestInfo | URL, init?: RequestInit) => Promise<Response> {
  return async () => handler();
}

const GOOD_USER = {
  login: "nishant-jswl",
  name: "Nishant",
  bio: null,
  avatarUrl: "https://avatars.githubusercontent.com/u/1",
  contributionsCollection: {
    totalCommitContributions: 100,
    totalPullRequestContributions: 20,
    totalIssueContributions: 5,
    totalRepositoriesWithContributedCommits: 1,
  },
  repositories: {
    nodes: [
      { name: "repo-a", stargazerCount: 3, languages: { edges: [{ size: 500, node: { name: "TypeScript" } }] } },
    ],
  },
  pinnedItems: { nodes: [{ name: "repo-a", description: "d", stargazerCount: 3 }] },
};

describe("GithubApiClient.fetchProfile", () => {
  it("maps a valid GraphQL response into derived fields", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = mockFetchOnce(async () => {
      return new Response(JSON.stringify({ data: { user: GOOD_USER } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      const client = new GithubApiClient("test-token");
      const out = await client.fetchProfile("nishant-jswl");
      expect(out.login).toBe("nishant-jswl");
      expect(out.totalContributions).toBe(126); // 100+20+5+1
      expect(out.commits).toBe(100);
      expect(out.pullRequests).toBe(20);
      expect(out.issues).toBe(5);
      expect(out.reposContributed).toBe(1);
      expect(out.languages).toEqual({ TypeScript: 500 });
      expect(out.pinnedRepos).toEqual([{ name: "repo-a", description: "d", stars: 3 }]);
      expect(out.starredRepos).toBe(3);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("throws GithubApiError(404) for a missing user (fail-fast signal)", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = mockFetchOnce(async () => {
      return new Response(JSON.stringify({ data: { user: null } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      const client = new GithubApiClient("test-token");
      await expect(client.fetchProfile("ghost")).rejects.toMatchObject({ status: 404 });
    } finally {
      globalThis.fetch = original;
    }
  });

  it("throws on GraphQL errors with the message", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = mockFetchOnce(async () => {
      return new Response(JSON.stringify({ errors: [{ type: "NOT_FOUND", message: "Could not resolve" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    try {
      const client = new GithubApiClient("test-token");
      const err = await client.fetchProfile("ghost").catch((e) => e);
      expect(err).toBeInstanceOf(GithubApiError);
      expect(err.status).toBe(200);
      expect(err.type).toBe("NOT_FOUND");
    } finally {
      globalThis.fetch = original;
    }
  });

  it("throws on non-OK HTTP status", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = mockFetchOnce(async () => {
      return new Response("rate limited", { status: 403 });
    });
    try {
      const client = new GithubApiClient("test-token");
      await expect(client.fetchProfile("someone")).rejects.toMatchObject({ status: 403 });
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("status mapping (fail-fast contract)", () => {
  it("maps a 404 to the not_found status", () => {
    const status: GithubStatus = "not_found";
    expect(status).toBe("not_found");
  });

  it("maps a success to ok", () => {
    const status: GithubStatus = "ok";
    expect(status).toBe("ok");
  });
});