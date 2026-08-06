export type TemplateId = "pixel" | "arcade" | "fastfetch";
export type DefaultMascotId = "webswing" | "headturn" | "none";

export interface ThemeColors {
  bg: string;
  fg: string;
  accent: string;
  muted: string;
}

/** User-configurable values for a profile card (the `fields` jsonb column). */
export interface ProfileFields {
  name?: string | null;
  role?: string | null;
  tagline?: string | null;
  mascotSvgUrl?: string | null;
  /** Which built-in animation to show when no custom mascot is uploaded. */
  defaultMascot?: DefaultMascotId | null;
}

/** The persisted user profile configuration row. */
export interface ProfileConfig {
  id: string;
  userId: string;
  username: string;
  templateId: TemplateId;
  theme: ThemeColors;
  fields: ProfileFields;
  configHash: string;
  updatedAt: string;
}

export type GithubStatus = "ok" | "not_found" | "error";

/** GitHub-derived data stored in github_data_cache (never the raw GraphQL JSON). */
export interface GithubDataCache {
  username: string;
  login: string;
  name?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  totalContributions: number;
  commits: number;
  pullRequests: number;
  issues: number;
  reposContributed: number;
  /** language name -> bytes, top N only. */
  languages: Record<string, number>;
  pinnedRepos: { name: string; description?: string | null; stars: number }[];
  starredRepos: number;
  fetchedAt: string;
  etagKey?: string;
  lastStatus: GithubStatus;
  failureCount: number;
}

/** Fully-resolved input handed to a template render function. */
export interface RenderInput {
  templateId: TemplateId;
  theme: ThemeColors;
  fields: ProfileFields;
  data: Pick<
    GithubDataCache,
    | "login"
    | "name"
    | "bio"
    | "totalContributions"
    | "commits"
    | "pullRequests"
    | "issues"
    | "reposContributed"
    | "languages"
    | "starredRepos"
    | "pinnedRepos"
  >;
  mascotSvg?: string | null;
  /** User's chosen default mascot animation (null = use template's own default). */
  defaultMascot?: DefaultMascotId | null;
}
