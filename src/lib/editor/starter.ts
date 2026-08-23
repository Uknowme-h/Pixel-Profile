import { BLOCK_REGISTRY, newNodeId } from "@/lib/editor/registry";
import type { EditorScene } from "@/lib/editor/types";

/** Fixture scene for E0: text + stat pills + pulsing rect. */
export function starterScene(): EditorScene {
  const byType = Object.fromEntries(BLOCK_REGISTRY.map((b) => [b.type, b]));
  let z = 0;
  const node = (type: keyof typeof byType, patch: Partial<EditorScene["nodes"][0]> = {}) => {
    const def = byType[type];
    return { ...def.defaults, ...patch, id: newNodeId(), z: z++ };
  };
  return {
    version: 1,
    width: 800,
    height: 400,
    background: { fill: "#111111", radius: 0 },
    nodes: [
      node("shape.ellipse", {
        x: 560,
        y: 16,
        w: 200,
        h: 200,
        animation: "drift",
        animDur: 8,
        animAmount: 70,
        props: { fill: "#c8f54a", opacity: 0.2 },
      }),
      node("shape.ellipse", {
        x: -24,
        y: 250,
        w: 160,
        h: 120,
        animation: "glow",
        animDur: 5.4,
        animDelay: 0.5,
        props: { fill: "#c8f54a", opacity: 0.16 },
      }),
      node("text", {
        props: { content: "Your text", fill: "#f5f5f0", fontSize: 32, weight: "bold" },
      }),
      node("shape.line", { y: 72, w: 280 }),
      node("statPill", {
        x: 32,
        y: 100,
        props: { label: "commits", value: "{{stats.commits}}", fill: "#1c1c1a", accent: "#c8f54a", text: "#f5f5f0" },
      }),
      node("statPill", {
        x: 196,
        y: 100,
        animation: "pulse",
        props: { label: "contributions", value: "{{stats.contributions}}", fill: "#1c1c1a", accent: "#c8f54a", text: "#f5f5f0" },
      }),
      node("languageBar", { x: 32, y: 188, w: 400, h: 120 }),
      node("shape.rect", {
        x: 560,
        y: 100,
        w: 180,
        h: 180,
        animation: "pulse",
        props: { fill: "#c8f54a", radius: 2 },
      }),
      node("socialButton", { x: 560, y: 32, w: 180, h: 40 }),
    ],
  };
}
