import { getServiceClient } from "@/lib/supabase/server";
import type { GithubDataCache, GithubStatus, ProfileConfig, TemplateId } from "@/types";

/**
 * Typed data access over the service-role client. Used by the render route,
 * the refresh workflow, and the upload endpoint. All row shapes map to the
 * snake_case columns in supabase/schema.sql.
 */

interface ProfileConfigRow {
  id: string;
  user_id: string;
  username: string;
  template_id: TemplateId;
  theme: Record<string, unknown>;
  fields: Record<string, unknown>;
  mascot_svg_url: string | null;
  config_hash: string;
  updated_at: string;
}

function mapConfig(row: ProfileConfigRow): ProfileConfig {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    templateId: row.template_id,
    theme: row.theme as unknown as ProfileConfig["theme"],
    fields: row.fields as ProfileConfig["fields"],
    mascotSvgUrl: row.mascot_svg_url,
    configHash: row.config_hash,
    updatedAt: row.updated_at,
  };
}

/** Fetch the current user's saved card config (one per user). */
export async function getConfigByUser(userId: string): Promise<ProfileConfig | null> {
  const { data, error } = await getServiceClient()
    .from("profile_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapConfig(data as ProfileConfigRow) : null;
}

/** Fetch a user's config by GitHub username (the thing camo asks for). */
export async function getConfigByUsername(username: string): Promise<ProfileConfig | null> {
  const { data, error } = await getServiceClient()
    .from("profile_configs")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data ? mapConfig(data as ProfileConfigRow) : null;
}

export async function upsertConfig(
  userId: string,
  config: {
    username: string;
    templateId: TemplateId;
    theme: ProfileConfig["theme"];
    fields: ProfileConfig["fields"];
    mascotSvgUrl?: string | null;
    configHash: string;
  }
): Promise<ProfileConfig> {
  const row = {
    user_id: userId,
    username: config.username,
    template_id: config.templateId,
    theme: config.theme,
    fields: config.fields,
    mascot_svg_url: config.mascotSvgUrl ?? null,
    config_hash: config.configHash,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await getServiceClient()
    .from("profile_configs")
    .upsert(row, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return mapConfig(data as ProfileConfigRow);
}

interface CacheRow {
  username: string;
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string | null;
  total_contributions: number;
  commits: number | null;
  pull_requests: number | null;
  issues: number | null;
  repos_contributed: number | null;
  languages: Record<string, number>;
  pinned_repos: { name: string; description: string | null; stars: number }[];
  starred_repos: number;
  fetched_at: string;
  etag_key: string | null;
  last_status: GithubStatus;
  failure_count: number;
  updated_at: string;
}

function mapCache(row: CacheRow): GithubDataCache {
  return {
    username: row.username,
    login: row.login,
    name: row.name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    totalContributions: row.total_contributions,
    commits: row.commits ?? 0,
    pullRequests: row.pull_requests ?? 0,
    issues: row.issues ?? 0,
    reposContributed: row.repos_contributed ?? 0,
    languages: row.languages,
    pinnedRepos: row.pinned_repos,
    starredRepos: row.starred_repos ?? 0,
    fetchedAt: row.fetched_at,
    etagKey: row.etag_key ?? undefined,
    lastStatus: row.last_status,
    failureCount: row.failure_count,
  };
}

export async function getCache(username: string): Promise<GithubDataCache | null> {
  const { data, error } = await getServiceClient()
    .from("github_data_cache")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCache(data as CacheRow) : null;
}

export async function upsertCache(
  username: string,
  data: Omit<GithubDataCache, "username"> & { username?: string }
): Promise<void> {
  const row = {
    username,
    login: data.login,
    name: data.name ?? null,
    bio: data.bio ?? null,
    avatar_url: data.avatarUrl ?? null,
    total_contributions: data.totalContributions,
    commits: data.commits ?? 0,
    pull_requests: data.pullRequests ?? 0,
    issues: data.issues ?? 0,
    repos_contributed: data.reposContributed ?? 0,
    languages: data.languages,
    pinned_repos: data.pinnedRepos,
    starred_repos: data.starredRepos,
    fetched_at: data.fetchedAt,
    etag_key: data.etagKey ?? null,
    last_status: data.lastStatus,
    failure_count: data.failureCount,
    updated_at: new Date().toISOString(),
  };
  const { error } = await getServiceClient().from("github_data_cache").upsert(row);
  if (error) throw error;
}

/** Mark a username as failing (fail-fast, Phase 5). */
export async function markCacheFailure(username: string, status: GithubStatus): Promise<void> {
  const existing = await getCache(username);
  const failureCount = (existing?.failureCount ?? 0) + 1;
  const { error } = await getServiceClient()
    .from("github_data_cache")
    .upsert({
      username,
      login: username,
      name: existing?.name ?? null,
      bio: existing?.bio ?? null,
      avatar_url: existing?.avatarUrl ?? null,
      total_contributions: existing?.totalContributions ?? 0,
      commits: existing?.commits ?? 0,
      pull_requests: existing?.pullRequests ?? 0,
      issues: existing?.issues ?? 0,
      repos_contributed: existing?.reposContributed ?? 0,
      languages: existing?.languages ?? {},
      pinned_repos: existing?.pinnedRepos ?? [],
      starred_repos: existing?.starredRepos ?? 0,
      fetched_at: existing?.fetchedAt ?? new Date().toISOString(),
      etag_key: existing?.etagKey ?? null,
      last_status: status,
      failure_count: failureCount,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

export async function resetCacheFailure(username: string): Promise<void> {
  const { error } = await getServiceClient()
    .from("github_data_cache")
    .update({ failure_count: 0, last_status: "ok", updated_at: new Date().toISOString() })
    .eq("username", username);
  if (error) throw error;
}

/** Stalest-first batch for the refresh sweep (Phase 5). */
export async function getStalestCacheRows(limit: number): Promise<{ username: string; fetched_at: string; last_status: string; failure_count: number }[]> {
  const { data, error } = await getServiceClient()
    .from("github_data_cache")
    .select("username, fetched_at, last_status, failure_count")
    .order("fetched_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as { username: string; fetched_at: string; last_status: string; failure_count: number }[];
}

/** Which usernames are actually configured (drives refresh + render). */
export async function getAllConfiguredUsernames(): Promise<string[]> {
  const { data, error } = await getServiceClient().from("profile_configs").select("username");
  if (error) throw error;
  return [...new Set((data ?? []).map((r) => r.username))];
}
