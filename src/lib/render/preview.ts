import { renderTemplate, DEFAULT_THEME } from "@/lib/svg/templates";
import { getCache } from "@/lib/data/store";
import { getMascotSvgByUrl } from "@/lib/render/service";
import { fetchProfileWithStatus } from "@/lib/github/api";
import type { GithubDataCache, RenderInput, TemplateId, ThemeColors, DefaultMascotId, BarStyle } from "@/types";

/**
 * Live preview for the builder.
 *
 * Reads the current form state (fields, theme, mascot URL) from query params so
 * the preview is real-time, then layers in the user's real cached GitHub data
 * (falling back to demo data when none exists yet). Same engine as production.
 *
 * Performance: process-level in-memory caches avoid a DB hit + a Storage fetch
 * on every keystroke. GitHub data is stable for ~30 min; mascot SVGs rarely
 * change at all. Both are evicted on their own TTLs.
 */

// ── Process-level in-memory caches ───────────────────────────────────────────
// Module vars persist across requests in the same Node.js process (Next.js
// server). Safe for preview: stale-by-at-most-TTL is fine for a live builder.

const GITHUB_TTL  = 5 * 60_000; // 5 minutes
const MASCOT_TTL  = 2 * 60_000; // 2 minutes — short enough that re-uploads surface quickly

type CachedData = Pick<
  GithubDataCache,
  | "login" | "name" | "bio"
  | "totalContributions" | "commits" | "pullRequests" | "issues" | "reposContributed"
  | "languages" | "starredRepos" | "pinnedRepos"
>;

const githubCache = new Map<string, { data: CachedData; expiresAt: number }>();
const mascotCache = new Map<string, { svg: string; expiresAt: number }>();

async function getCachedGithubData(username: string): Promise<CachedData | null> {
  const now = Date.now();
  const hit = githubCache.get(username);
  if (hit && hit.expiresAt > now) return hit.data;

  // 1. Try the DB cache first (fast, free).
  const row = await getCache(username).catch(() => null);
  if (row) {
    const data: CachedData = {
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
    githubCache.set(username, { data, expiresAt: now + GITHUB_TTL });
    return data;
  }

  // 2. DB miss — fetch live from GitHub API so any valid username works in the
  //    builder preview, not just ones already in the refresh cycle.
  //    We only cache in-process (not DB) since the refresh workflow owns the DB.
  const { result } = await fetchProfileWithStatus(username).catch(() => ({ result: null }));
  if (!result) return null;

  const data: CachedData = {
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
  githubCache.set(username, { data, expiresAt: now + GITHUB_TTL });
  return data;
}

async function getCachedMascotSvg(url: string): Promise<string | null> {
  const now = Date.now();
  const hit = mascotCache.get(url);
  if (hit && hit.expiresAt > now) return hit.svg;

  const svg = await getMascotSvgByUrl(url).catch(() => null);
  if (svg) mascotCache.set(url, { svg, expiresAt: now + MASCOT_TTL });
  return svg ?? null;
}

const DEMO_DATA = {
  login: "preview-user",
  name: "Pixel Dev",
  bio: "infrastructure & pixel art",
  totalContributions: 2147,
  commits: 1800,
  pullRequests: 247,
  issues: 100,
  reposContributed: 34,
  languages: { TypeScript: 48213, Rust: 21990, Go: 12450, Python: 9100, Shell: 4200 },
  starredRepos: 138,
  pinnedRepos: [
    { name: "pixel-card", description: "generative README svg", stars: 12 },
    { name: "voice-agent", description: "real-time voice AI agent", stars: 8 },
    { name: "edge-router", description: "lightweight edge proxy", stars: 31 },
  ],
};

export async function renderPreview(
  req: Request,
  templateId: TemplateId
): Promise<string> {
  const url = new URL(req.url);

  const VALID_MASCOTS: DefaultMascotId[] = ["webswing", "headturn", "github", "copilot", "octopuss", "none"];
  const VALID_BAR_ANIMS: BarStyle[] = ["ease-out", "bounce", "linear", "step"];
  const isHex = (s: string | null): s is string => !!s && /^#[0-9a-fA-F]{6}$/.test(s);

  const rawMascot = url.searchParams.get("defaultMascot");
  const rawBarAnim = url.searchParams.get("barAnim");
  const barColors = [0, 1, 2, 3]
    .map((i) => url.searchParams.get(`barColor${i}`))
    .filter(isHex);

  const fields = {
    name: url.searchParams.get("name") || null,
    role: url.searchParams.get("role") || null,
    tagline: url.searchParams.get("tagline") || null,
    mascotSvgUrl: url.searchParams.get("mascot") || null,
    defaultMascot: (VALID_MASCOTS.includes(rawMascot as DefaultMascotId) ? rawMascot : null) as DefaultMascotId | null,
    barColors: barColors.length > 0 ? barColors : null,
    barAnimation: (VALID_BAR_ANIMS.includes(rawBarAnim as BarStyle) ? rawBarAnim : null) as BarStyle | null,
  };

  const theme: ThemeColors = {
    bg: url.searchParams.get("bg") || DEFAULT_THEME.bg,
    fg: url.searchParams.get("fg") || DEFAULT_THEME.fg,
    accent: url.searchParams.get("accent") || DEFAULT_THEME.accent,
    muted: url.searchParams.get("muted") || DEFAULT_THEME.muted,
  };

  // Fetch GitHub data + mascot in parallel; both are served from process-level
  // caches after the first hit so subsequent keystrokes cost nothing extra.
  const username = url.pathname.split("/")[3] ?? "";
  const [githubData, mascotSvg] = await Promise.all([
    username ? getCachedGithubData(username) : Promise.resolve(null),
    fields.mascotSvgUrl ? getCachedMascotSvg(fields.mascotSvgUrl) : Promise.resolve(null),
  ]);
  const data = githubData ?? DEMO_DATA;

  const input: RenderInput = {
    templateId,
    theme,
    fields,
    data,
    mascotSvg,
    defaultMascot: fields.defaultMascot,
  };

  return renderTemplate(templateId, input);
}
