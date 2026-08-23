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

  it("keeps a transparent sheet fill", () => {
    const scene = parseScene({
      width: 800,
      height: 400,
      background: { fill: "none" },
      nodes: [],
    });
    expect(scene.background.fill).toBe("none");
  });
});

describe("editor compile", () => {
  it("renders the starter scene to a sanitized SVG with tokens and SMIL", () => {
    const svg = compileScene(starterScene(), DEMO_COMPILE_DATA);
    expect(svg).toContain("<svg");
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("Your text");
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

  it("emits tunable SMIL for drift, glow, delay, and amount", () => {
    const svg = compileScene({
      width: 400,
      height: 200,
      background: { fill: "#111111" },
      nodes: [
        {
          id: "nDrift",
          type: "shape.ellipse",
          x: 0,
          y: 0,
          w: 80,
          h: 80,
          z: 0,
          animation: "drift",
          animDur: 4.5,
          animDelay: 0.8,
          animAmount: 100,
          props: { fill: "#c8f54a", opacity: 0.3 },
        },
        {
          id: "nGlow",
          type: "shape.ellipse",
          x: 100,
          y: 0,
          w: 80,
          h: 80,
          z: 1,
          animation: "glow",
          animDur: 3,
          props: { fill: "#c8f54a", opacity: 0.4 },
        },
      ],
    });
    expect(svg).toContain('type="translate"');
    expect(svg).toContain('dur="4.50s"');
    expect(svg).toContain('begin="0.80s"');
    expect(svg).toContain("keySplines=");
    expect(svg).toContain('type="scale"');
    expect(svg).toContain('dur="3.00s"');
    expect(svg).toContain('opacity="0.30"');
    expect(svg).not.toContain("<script");
  });

  it("lets language names pick a color and truncates long labels", () => {
    const svg = compileScene(
      {
        width: 400,
        height: 200,
        background: { fill: "#111111" },
        nodes: [
          {
            id: "nLang",
            type: "languageBar",
            x: 0,
            y: 0,
            w: 160,
            h: 80,
            z: 0,
            animation: "none",
            props: { fill: "#1c1c1a", bar: "#c8f54a", text: "#ff00aa" },
          },
        ],
      },
      { ...DEMO_COMPILE_DATA, languages: { "Jupyter Notebook": 900, Rust: 100 } },
    );
    expect(svg).toContain('fill="#ff00aa"');
    expect(svg).toContain("…");
    expect(svg).not.toContain(">Jupyter Notebook<");
    expect(svg).toContain("Rust");
  });

  it("omits the sheet rect when fill is none and paints shape fill=none", () => {
    const svg = compileScene({
      width: 400,
      height: 200,
      background: { fill: "none" },
      nodes: [
        {
          id: "nRect",
          type: "shape.rect",
          x: 8,
          y: 8,
          w: 40,
          h: 40,
          z: 0,
          animation: "none",
          props: { fill: "none" },
        },
      ],
    });
    expect(svg).not.toMatch(/<rect x="0" y="0" width="400"/);
    expect(svg).toContain('fill="none"');
  });
});
