import type { BuiltInBlockType, SceneNode } from "@/lib/editor/types";

export interface BlockDef {
  type: BuiltInBlockType;
  label: string;
  category: "content" | "data" | "shape" | "asset";
  hint: string;
  defaults: Omit<SceneNode, "id" | "z">;
}

export const BLOCK_REGISTRY: BlockDef[] = [
  {
    type: "text",
    label: "Text",
    category: "content",
    hint: "Type anything. Optional {{name}} token.",
    defaults: {
      type: "text",
      x: 32,
      y: 28,
      w: 360,
      h: 40,
      animation: "none",
      visible: true,
      props: { content: "Your text", fill: "#f5f5f0", fontSize: 28, weight: "bold" },
    },
  },
  {
    type: "statPill",
    label: "Stat pill",
    category: "data",
    hint: "One GitHub number.",
    defaults: {
      type: "statPill",
      x: 32,
      y: 88,
      w: 148,
      h: 64,
      animation: "none",
      visible: true,
      props: { label: "commits", value: "{{stats.commits}}", fill: "#1c1c1a", accent: "#c8f54a", text: "#f5f5f0" },
    },
  },
  {
    type: "statRow",
    label: "Stat row",
    category: "data",
    hint: "Commits, PRs, issues.",
    defaults: {
      type: "statRow",
      x: 32,
      y: 168,
      w: 520,
      h: 72,
      animation: "none",
      visible: true,
      props: { fill: "#1c1c1a", accent: "#c8f54a", text: "#f5f5f0" },
    },
  },
  {
    type: "languageBar",
    label: "Languages",
    category: "data",
    hint: "Top languages from GitHub.",
    defaults: {
      type: "languageBar",
      x: 32,
      y: 260,
      w: 360,
      h: 96,
      animation: "none",
      visible: true,
      props: { fill: "#f5f5f0", bar: "#c8f54a", muted: "#9a9a90" },
    },
  },
  {
    type: "socialButton",
    label: "Badge",
    category: "content",
    hint: "Label chip. Wrap the card in a link for clicks.",
    defaults: {
      type: "socialButton",
      x: 560,
      y: 32,
      w: 160,
      h: 40,
      animation: "none",
      visible: true,
      props: { label: "GitHub", fill: "#c8f54a", text: "#111111" },
    },
  },
  {
    type: "shape.rect",
    label: "Rect",
    category: "shape",
    hint: "Rounded panel or accent.",
    defaults: {
      type: "shape.rect",
      x: 560,
      y: 96,
      w: 200,
      h: 120,
      animation: "pulse",
      visible: true,
      props: { fill: "#c8f54a", radius: 4 },
    },
  },
  {
    type: "shape.ellipse",
    label: "Ellipse",
    category: "shape",
    hint: "Orb or avatar stand-in.",
    defaults: {
      type: "shape.ellipse",
      x: 600,
      y: 240,
      w: 80,
      h: 80,
      animation: "float",
      visible: true,
      props: { fill: "#f5f5f0" },
    },
  },
  {
    type: "shape.line",
    label: "Line",
    category: "shape",
    hint: "Hairline rule.",
    defaults: {
      type: "shape.line",
      x: 32,
      y: 72,
      w: 240,
      h: 8,
      animation: "none",
      visible: true,
      props: { stroke: "#c8f54a", strokeWidth: 2 },
    },
  },
  {
    type: "sprite",
    label: "GIF sprite",
    category: "asset",
    hint: "Upload a GIF — compiled to SMIL.",
    defaults: {
      type: "sprite",
      x: 480,
      y: 200,
      w: 128,
      h: 128,
      animation: "none",
      visible: true,
      props: { sheet: "", frames: 1, fw: 128, fh: 128, dur: "1s", fps: 8 },
    },
  },
];

export function blockDef(type: BuiltInBlockType): BlockDef {
  const def = BLOCK_REGISTRY.find((b) => b.type === type);
  if (!def) throw new Error(`unknown block: ${type}`);
  return def;
}

export function newNodeId(): string {
  const n = Math.random().toString(36).slice(2, 10);
  return `n${n}`;
}
