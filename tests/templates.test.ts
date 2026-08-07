import { describe, expect, it } from "vitest";
import { renderTemplate, TEMPLATES } from "@/lib/svg/templates";
import type { RenderInput } from "@/types";

const BASE_INPUT: RenderInput = {
  templateId: "pixel",
  theme: { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7", muted: "#565f89" },
  fields: { name: "NISHANT", role: "dev", tagline: null, mascotSvgUrl: null },
  data: {
    login: "nishant-jswl",
    name: "Nishant",
    bio: "infra",
    totalContributions: 2147,
    commits: 1800,
    pullRequests: 247,
    issues: 100,
    reposContributed: 34,
    languages: { TypeScript: 100, Rust: 50 },
    starredRepos: 42,
    pinnedRepos: [{ name: "pixel-card", description: "svg", stars: 12 }],
  },
  mascotSvg: null,
};

describe("template engine", () => {
  it("pixel template renders a full valid SVG with the right header", () => {
    const svg = renderTemplate("pixel", BASE_INPUT);
    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("</svg>");
    expect(svg).toContain('role="img"');
    expect(svg).toContain("crispEdges");
    // Text is pixel rects — verify pixel-font content was emitted, not literal text.
    expect(svg.match(/<rect /g)?.length).toBeGreaterThan(50);
  });

  it("arcade template renders the game-cabinet card structure", () => {
    const svg = renderTemplate("arcade", { ...BASE_INPUT, templateId: "arcade" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg.match(/<rect /g)?.length).toBeGreaterThan(3);
    expect(svg).toContain("PLAYER PROFILE");
    expect(svg).toContain("STATUS");
  });

  it("renders the contribution count as a pixel block (some pixel density)", () => {
    const svg = renderTemplate("pixel", BASE_INPUT);
    const pixelCount = svg.match(/<rect /g)?.length ?? 0;
    // 2147 is 4 glyphs of pixel text — should add noticeable density.
    expect(pixelCount).toBeGreaterThan(100);
  });

  it("fastfetch template renders a terminal-style card", () => {
    const svg = renderTemplate("fastfetch", { ...BASE_INPUT, templateId: "fastfetch" });
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("fastfetch");
    // New design uses Bio / Commits / PRs / Issues instead of Role / Contributions
    expect(svg).toContain("Bio");
    expect(svg).toContain("Commits");
    expect(svg).toContain("PRs");
    expect(svg).toContain("Issues");
    // Terminal prompt must be present
    expect(svg).toContain(":~$");
    // Color swatches present
    expect(svg).toContain("#ff5f57");
  });

  it("arcade template uses the mascot as the selected character", () => {
    const mascotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><rect width="50" height="50" fill="#0f0"/></svg>`;
    const svg = renderTemplate("arcade", { ...BASE_INPUT, templateId: "arcade", mascotSvg });
    expect(svg).toContain("CHARACTER SELECT");
    expect(svg).toContain('viewBox="0 0 50 50"');
    expect(svg).toContain("PLAYER PROFILE");
  });

  it("arcade renders pinned repos in the quest log", () => {
    const svg = renderTemplate("arcade", { ...BASE_INPUT, templateId: "arcade" });
    expect(svg).toContain("QUEST LOG");
    expect(svg).toContain("pixel-card");
  });

  it("unknown template throws", () => {
    expect(() => renderTemplate("nope" as never, BASE_INPUT)).toThrow(/unknown template/);
  });

  it("TEMPLATES registry contains the three v1 templates", () => {
    expect(Object.keys(TEMPLATES).sort()).toEqual(["arcade", "fastfetch", "pixel"]);
    for (const t of Object.values(TEMPLATES)) {
      expect(t.render).toBeTypeOf("function");
    }
  });

  it("top language adds an extra pixel-text block", () => {
    const svg = renderTemplate("pixel", BASE_INPUT);
    const withLang = svg.match(/<rect /g)?.length ?? 0;
    const noLang = renderTemplate("pixel", {
      ...BASE_INPUT,
      data: { ...BASE_INPUT.data, languages: {} },
    }).match(/<rect /g)?.length ?? 0;
    expect(withLang).toBeGreaterThan(noLang);
  });

  it("embeds a normalized mascot when provided", () => {
    const mascotSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="50" height="50" viewBox="0 0 50 50"><rect width="50" height="50" fill="#0f0"/></svg>`;
    const svg = renderTemplate("pixel", { ...BASE_INPUT, mascotSvg });
    expect(svg).toContain('viewBox="0 0 50 50"');
    expect(svg).toContain("crispEdges");
  });

  it("renders the octopuss default mascot as a self-animated sprite", () => {
    const svg = renderTemplate("pixel", { ...BASE_INPUT, defaultMascot: "octopuss" });
    expect(svg).toContain("animateTransform");
    expect(svg).toContain("crispEdges");
  });

  it("produces valid transform attributes (no literal arithmetic strings)", () => {
    const svg = renderTemplate("arcade", { ...BASE_INPUT, templateId: "arcade" });
    expect(svg).not.toContain("32 +");
    expect(svg).not.toContain("44 +");
    expect(svg).not.toContain("200 +");
  });
});