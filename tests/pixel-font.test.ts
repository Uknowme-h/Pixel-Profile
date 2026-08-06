import { describe, expect, it } from "vitest";
import { renderPixelText } from "@/lib/svg/pixel-font";

/**
 * Phase 8 — golden/snapshot tests for the pixel-font atlas.
 * One shifted pixel is broken art; these catch regressions automatically.
 */

describe("renderPixelText", () => {
  it("renders a single glyph as a group of rects with crispEdges", () => {
    const out = renderPixelText("A", { scale: 4, fill: "#c0caf5" });
    expect(out.svg).toContain('shape-rendering="crispEdges"');
    expect(out.svg).toContain("</g>");
    expect(out.width).toBeGreaterThan(0);
    expect(out.height).toBeGreaterThan(0);
  });

  it("each lit pixel becomes exactly one <rect>", () => {
    // Count lit pixels in the 'A' glyph: rows [01110,10001,10001,11111,10001,10001,10001]
    const expected = 3 + 2 + 2 + 5 + 2 + 2 + 2;
    const out = renderPixelText("A", { scale: 1, fill: "#000" });
    const matches = out.svg.match(/<rect /g) ?? [];
    expect(matches.length).toBe(expected);
  });

  it("uppercases input so lowercase 'name' maps to a glyph", () => {
    const out = renderPixelText("a", { scale: 1, fill: "#000" });
    const matches = out.svg.match(/<rect /g) ?? [];
    // 'A' has (3+2+2+5+2+2+2) = 18 lit pixels at scale 1.
    expect(matches.length).toBe(18);
  });

  it("unknown glyph (emoji/CJK) is silently dropped, never crashes", () => {
    // Emoji are replaced with space by sanitizeForPixelFont — no rects, no crash.
    const out = renderPixelText("🚀", { scale: 2, fill: "#f00" });
    expect(out.svg).not.toContain("<rect");
    // Known punctuation now has proper glyphs
    const bang = renderPixelText("!", { scale: 2, fill: "#f00" });
    expect(bang.svg).toContain("<rect");
    expect(bang.width).toBeGreaterThan(0);
  });

  it("accented characters normalize to their ASCII base via NFD", () => {
    // é → E, ñ → N, ü → U — same rect count as the ASCII uppercase equivalent
    const accent = renderPixelText("é", { scale: 1, fill: "#000" });
    const ascii  = renderPixelText("E", { scale: 1, fill: "#000" });
    expect((accent.svg.match(/<rect /g) ?? []).length).toBe(
      (ascii.svg.match(/<rect /g) ?? []).length,
    );
  });

  it("spaces produce separations (no rects for space itself)", () => {
    const space = renderPixelText(" ", { scale: 3, fill: "#000" });
    expect(space.svg.match(/<rect /g) ?? []).toHaveLength(0);
  });

  it("multi-line text grows height and draws both lines", () => {
    const out = renderPixelText("AB\nCD", { scale: 2, fill: "#000" });
    expect(out.height).toBeGreaterThan(renderPixelText("AB", { scale: 2, fill: "#000" }).height);
    expect(out.width).toBeGreaterThan(0);
  });

  it("produces valid whole-pixel rectangles", () => {
    const out = renderPixelText("HI", { scale: 5, fill: "#fff" });
    const rect = out.svg.match(/<rect x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/);
    expect(rect).not.toBeNull();
    for (const n of [rect![1], rect![2], rect![3], rect![4]]) {
      expect(Number(n)).toBe(Math.round(Number(n)));
    }
  });
});