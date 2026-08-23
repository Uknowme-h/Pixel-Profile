import type { CompileData } from "@/lib/editor/types";

/** Fallback GitHub-shaped data when the user has no cache row yet. */
export const DEMO_COMPILE_DATA: CompileData = {
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
