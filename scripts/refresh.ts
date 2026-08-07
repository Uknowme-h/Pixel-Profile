import { existsSync } from "node:fs";
import { getServiceClient } from "../src/lib/supabase/server";
import { fetchProfileWithStatus } from "../src/lib/github/api";
import {
  getAllConfiguredUsernames,
  upsertCache,
  markCacheFailure,
  resetCacheFailure,
} from "../src/lib/data/store";

/**
 * Phase 5 — background refresh.
 *
 * Runs inside a GitHub Actions `schedule:` workflow (Vercel Cron Jobs are
 * Pro-only). Pulls a batch of the stalest configured profiles once a day,
 * fetches fresh derived data from GitHub GraphQL, writes it back to Supabase,
 * and exits. The writes double as a keep-alive so the free Supabase project
 * stays awake. Fail-fast: 404 usernames get flagged, not retried forever.
 *
 * Locally, load `.env` / `.env.local` when present. In Actions the same vars
 * are injected via workflow `env:` — requiring `--env-file=.env` breaks CI
 * because that file is never checked in.
 */
for (const file of [".env", ".env.local"]) {
  if (existsSync(file)) process.loadEnvFile(file);
}

// Skip usernames above this failure count in a sweep (don't burn rate budget).
const REFRESH_SKIP_AFTER_FAILURES = 3;
// Daily cron: default high enough to cover early user counts in one run.
const REFRESH_BATCH_SIZE = Number(process.env.REFRESH_BATCH_SIZE ?? 100);

async function run(): Promise<void> {
  const supabase = getServiceClient();
  const users = await getAllConfiguredUsernames();

  let batch;
  if (users.length > 0) {
    batch = await pickBatch(users);
  } else {
    // No configs yet: fall back to the stalest cache rows.
    const stale = await supabase
      .from("github_data_cache")
      .select("username, failure_count")
      .order("fetched_at", { ascending: true })
      .limit(REFRESH_BATCH_SIZE);
    batch = (stale.data ?? []).map((r) => ({ username: r.username, failureCount: r.failure_count ?? 0 }));
  }

  let ok = 0;
  let failed = 0;
  const failures: string[] = [];

  for (const item of batch) {
    if (item.failureCount >= REFRESH_SKIP_AFTER_FAILURES) {
      console.log(`skip ${item.username} (failureCount=${item.failureCount})`);
      continue;
    }
    try {
      const { result, status } = await fetchProfileWithStatus(item.username);
      if (!result || status === "not_found") {
        failed++;
        failures.push(item.username);
        await markCacheFailure(item.username, "not_found");
        continue;
      }
      await upsertCache(item.username, {
        login: result.login,
        name: result.name,
        bio: result.bio,
        avatarUrl: result.avatarUrl,
        totalContributions: result.totalContributions,
        commits: result.commits,
        pullRequests: result.pullRequests,
        issues: result.issues,
        reposContributed: result.reposContributed,
        languages: result.languages,
        pinnedRepos: result.pinnedRepos,
        starredRepos: result.starredRepos,
        fetchedAt: new Date().toISOString(),
        lastStatus: "ok",
        failureCount: 0,
      });
      await resetCacheFailure(item.username);
      ok++;
    } catch (err) {
      failed++;
      failures.push(item.username);
      console.error(`refresh failed: ${item.username}`, err instanceof Error ? err.message : err);
      await markCacheFailure(item.username, "error").catch((e) => {
        console.error(`failed to mark ${item.username} as error:`, e);
      });
    }
  }

  // Observability: structured line so a rising failure rate is easy to alert on.
  console.log(JSON.stringify({
    event: "refresh_complete",
    ok,
    failed,
    skipped: batch.length - ok - failed,
    failures,
    timestamp: new Date().toISOString(),
  }));

  if (failed > 0) {
    process.exitCode = 1;
  }
}

/** Never-fetched first, then oldest `fetched_at` — so a daily run rotates fairly. */
async function pickBatch(users: string[]) {
  const { data, error } = await getServiceClient()
    .from("github_data_cache")
    .select("username, failure_count, fetched_at")
    .in("username", users);
  if (error) throw error;

  const byUser = new Map(
    (data ?? []).map((r) => [
      r.username as string,
      {
        failureCount: (r.failure_count as number | null) ?? 0,
        fetchedAt: (r.fetched_at as string | null) ?? null,
      },
    ]),
  );

  return users
    .map((username) => {
      const row = byUser.get(username);
      return {
        username,
        failureCount: row?.failureCount ?? 0,
        fetchedAt: row?.fetchedAt ?? null,
      };
    })
    .sort((a, b) => {
      if (a.fetchedAt === null && b.fetchedAt !== null) return -1;
      if (a.fetchedAt !== null && b.fetchedAt === null) return 1;
      if (a.fetchedAt === null || b.fetchedAt === null) return 0;
      return a.fetchedAt.localeCompare(b.fetchedAt);
    })
    .slice(0, REFRESH_BATCH_SIZE)
    .map(({ username, failureCount }) => ({ username, failureCount }));
}

run().catch((err) => {
  console.error("refresh crashed", err);
  process.exit(1);
});