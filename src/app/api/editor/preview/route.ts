import { compileScene } from "@/lib/editor/compile";
import { DEMO_COMPILE_DATA } from "@/lib/editor/demo";
import { SceneError } from "@/lib/editor/types";
import { getCache } from "@/lib/data/store";
import { fetchProfileWithStatus } from "@/lib/github/api";
import type { CompileData } from "@/lib/editor/types";

export const dynamic = "force-dynamic";

async function resolveData(username: string | undefined): Promise<CompileData> {
  if (!username || !/^[a-zA-Z0-9-]+$/.test(username)) return DEMO_COMPILE_DATA;
  const row = await getCache(username).catch(() => null);
  if (row) {
    return {
      login: row.login,
      name: row.name,
      bio: row.bio,
      totalContributions: row.totalContributions,
      commits: row.commits,
      pullRequests: row.pullRequests,
      issues: row.issues,
      reposContributed: row.reposContributed,
      languages: row.languages,
      starredRepos: row.starredRepos,
      pinnedRepos: row.pinnedRepos,
    };
  }
  const { result } = await fetchProfileWithStatus(username).catch(() => ({ result: null }));
  if (!result) return DEMO_COMPILE_DATA;
  return {
    login: result.login,
    name: result.name,
    bio: result.bio,
    totalContributions: result.totalContributions,
    commits: result.commits,
    pullRequests: result.pullRequests,
    issues: result.issues,
    reposContributed: result.reposContributed,
    languages: result.languages,
    starredRepos: result.starredRepos,
    pinnedRepos: result.pinnedRepos,
  };
}

/**
 * POST /api/editor/preview
 * Body: { scene, username? } → image/svg+xml (sanitized, GitHub-safe).
 */
export async function POST(request: Request) {
  let body: { scene?: unknown; username?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("invalid json", { status: 400 });
  }
  try {
    const data = await resolveData(body.username);
    const svg = compileScene(body.scene, data);
    return new Response(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (err) {
    const msg = err instanceof SceneError ? err.message : "compile failed";
    return new Response(msg, { status: 400 });
  }
}
