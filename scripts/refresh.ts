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
 * Pro-only). Pulls a small batch of the stalest configured profiles, fetches
 * fresh derived data from GitHub GraphQL, writes it back to Supabase, and
 * exits. The writes double as a keep-alive so the free Supabase project stays
 * awake. Fail-fast: 404 usernames get flagged, not retried forever.
 */

// Skip usernames above this failure count in a sweep (don't burn rate budget).
const REFRESH_SKIP_AFTER_FAILURES = 3;
const REFRESH_BATCH_SIZE = Number(process.env.REFRESH_BATCH_SIZE ?? 20);

async function run(): Promise<void> {
  const supabase = getServiceClient();
  const users = await getAllConfiguredUsernames();

  let batch;
  if (users.length > 0) {
    batch = await pickBatch(users);
  } else {
    // No sandbox: fall back to the stalest cache rows.
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

function pickBatch(users: string[]) {
  return users.slice(0, REFRESH_BATCH_SIZE).map((username) => ({ username, failureCount: 0 }));
}

run().catch((err) => {
  console.error("refresh crashed", err);
  process.exit(1);
});