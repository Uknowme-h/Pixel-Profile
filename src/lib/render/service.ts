import { getConfigByUsername, getCache, upsertCache } from "@/lib/data/store";
import { renderTemplate } from "@/lib/svg/templates";
import { fetchProfileWithStatus } from "@/lib/github/api";
import type { RenderInput } from "@/types";

/**
 * Phase 5 — render service.
 *
 * Resolves a username's config + cached derived data + stored mascot into a
 * finalized <svg> string via the template engine. Shared by the on-demand
 * render route and (optionally) the storage pre-render escape hatch so both
 * paths stay identical.
 */

/**
 * Fetch a stored mascot SVG from Supabase Storage by its public URL.
 *
 * The mascots bucket is public so a plain fetch is correct and avoids the
 * common mistake of passing a full URL to storage.download() (which expects
 * only the object path within the bucket, not the full URL).
 */
export async function getMascotSvgByUrl(mascotSvgUrl: string): Promise<string | null> {
  try {
    const res = await fetch(mascotSvgUrl);
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

export interface ResolveResult {
  svg?: string;
  error?: "not_found" | "no_config" | "no_data" | "render_error";
}

/** Fully resolve and render a profile card. */
export async function renderProfile(username: string): Promise<ResolveResult> {
  const config = await getConfigByUsername(username);
  if (!config) return { error: "no_config" };

  let data = await getCache(username);

  // First-time render: no cache row yet (user just saved their config and the
  // background refresh hasn't run). Do a live fetch and warm the cache so the
  // embed URL works immediately — the cron will keep it fresh from here on.
  if (!data) {
    const { result } = await fetchProfileWithStatus(username).catch(() => ({ result: null }));
    if (!result) return { error: "no_data" };
    await upsertCache(username, {
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
    }).catch(() => null); // non-fatal — render can still succeed
    data = await getCache(username);
    if (!data) return { error: "no_data" };
  }

  let mascotSvg: string | undefined;
  const mascotUrl = config.fields.mascotSvgUrl ?? config.mascotSvgUrl;
  if (mascotUrl) {
    const fetched = await getMascotSvgByUrl(mascotUrl);
    if (fetched) mascotSvg = fetched;
  }

  const input: RenderInput = {
    templateId: config.templateId,
    theme: config.theme,
    fields: config.fields,
    data: {
      login: data.login,
      name: data.name,
      bio: data.bio,
      totalContributions: data.totalContributions,
      commits: data.commits,
      pullRequests: data.pullRequests,
      issues: data.issues,
      reposContributed: data.reposContributed,
      languages: data.languages,
      starredRepos: data.starredRepos,
      pinnedRepos: data.pinnedRepos,
    },
    mascotSvg,
    defaultMascot: config.fields.defaultMascot,
  };

  try {
    return { svg: renderTemplate(config.templateId, input) };
  } catch {
    return { error: "render_error" };
  }
}