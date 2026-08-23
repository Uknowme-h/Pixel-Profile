import { describe, expect, it } from "vitest";
import { compileScene } from "@/lib/editor/compile";
import { parseScene } from "@/lib/editor/schema";
import { starterScene } from "@/lib/editor/starter";
import { resolveTokens } from "@/lib/editor/tokens";
import { DEMO_COMPILE_DATA } from "@/lib/editor/demo";
import { SceneError } from "@/lib/editor/types";

describe("editor tokens", () => {
  it("resolves GitHub stat paths and blanks unknown ones", () => {
    expect(resolveTokens("{{name}} / {{login}}", DEMO_COMPILE_DATA)).toBe("Pixel Dev / preview-user");
    expect(resolveTokens("{{stats.commits}}", DEMO_COMPILE_DATA)).toBe("1800");
    expect(resolveTokens("{{languages.0.name}}", DEMO_COMPILE_DATA)).toBe("TypeScript");
    expect(resolveTokens("{{nope.x}}", DEMO_COMPILE_DATA)).toBe("");
  });
});

describe("editor schema", () => {
  it("drops unknown block types instead of executing them", () => {
    const scene = parseScene({
      width: 800,
      height: 400,
      background: { fill: "#111111" },
      nodes: [
        { id: "nGood", type: "text", x: 0, y: 0, w: 40, h: 20, z: 0, props: { content: "hi" } },
        { id: "nBad", type: "evalHack", x: 0, y: 0, w: 40, h: 20, z: 1, props: {} },
      ],
    });
    expect(scene.nodes).toHaveLength(1);
    expect(scene.nodes[0].type).toBe("text");
  });

  it("rejects oversized node lists", () => {
    const nodes = Array.from({ length: 41 }, (_, i) => ({
      id: `n${i}`,
      type: "text",
      x: 0,
      y: 0,
      w: 10,
      h: 10,
      z: i,
      props: { content: "x" },
    }));
    expect(() => parseScene({ width: 800, height: 400, nodes })).toThrow(SceneError);
  });
});

describe("editor compile", () => {
  it("renders the starter scene to a sanitized SVG with tokens and SMIL", () => {
    const svg = compileScene(starterScene(), DEMO_COMPILE_DATA);
    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("Pixel Dev");
    expect(svg).toContain("1800");
    expect(svg).toContain("<animate");
    expect(svg).not.toContain("<script");
    expect(svg.toLowerCase()).not.toContain("foreignobject");
  });

  it("hard-rejects script payloads via the sanitizer", () => {
    const svg = compileScene({
      width: 400,
      height: 200,
      background: { fill: "#111111" },
      nodes: [{ id: "n1", type: "text", x: 8, y: 8, w: 100, h: 24, z: 0, props: { content: "<script>alert(1)</script>" } }],
    });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });
});
