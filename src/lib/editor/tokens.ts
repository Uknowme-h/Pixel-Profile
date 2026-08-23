import type { CompileData } from "@/lib/editor/types";

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function lookup(data: CompileData, path: string): string {
  const langs = Object.entries(data.languages).sort((a, b) => b[1] - a[1]);
  const langTotal = langs.reduce((s, [, n]) => s + n, 0) || 1;

  const table: Record<string, string> = {
    login: data.login,
    name: data.name ?? data.login,
    bio: data.bio ?? "",
    "stats.contributions": String(data.totalContributions),
    "stats.commits": String(data.commits),
    "stats.prs": String(data.pullRequests),
    "stats.issues": String(data.issues),
    "stats.repos": String(data.reposContributed),
    "stats.stars": String(data.starredRepos),
  };

  for (let i = 0; i < 5; i++) {
    const lang = langs[i];
    table[`languages.${i}.name`] = lang?.[0] ?? "";
    table[`languages.${i}.pct`] = lang ? String(Math.round((lang[1] / langTotal) * 100)) : "";
    const pin = data.pinnedRepos[i];
    table[`pinned.${i}.name`] = pin?.name ?? "";
    table[`pinned.${i}.stars`] = pin ? String(pin.stars) : "";
  }

  return table[path] ?? "";
}

/** Replace `{{login}}`-style tokens in a string. Unknown paths become empty. */
export function resolveTokens(value: string, data: CompileData): string {
  return value.replace(TOKEN, (_m, path: string) => lookup(data, path));
}

export function resolveNodeProps(
  props: Record<string, string | number | boolean>,
  data: CompileData,
): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(props)) {
    out[k] = typeof v === "string" ? resolveTokens(v, data) : v;
  }
  return out;
}
