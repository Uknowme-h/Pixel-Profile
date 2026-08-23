import {
  MAX_ARTBOARD_H,
  MAX_ARTBOARD_W,
  MAX_NODES,
  MAX_SCENE_BYTES,
  MIN_ARTBOARD,
  SCENE_VERSION,
  SceneError,
  type AnimationPresetId,
  type BlockType,
  type EditorScene,
  type SceneNode,
} from "@/lib/editor/types";

const BLOCK_TYPES = new Set<BlockType>([
  "text",
  "statPill",
  "statRow",
  "languageBar",
  "socialButton",
  "shape.rect",
  "shape.ellipse",
  "shape.line",
]);

const ANIMATIONS = new Set<AnimationPresetId>(["none", "fade", "pulse", "float", "spin", "wiggle"]);

const HEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;

function num(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && HEX.test(v) ? v : fallback;
}

function parseProps(raw: unknown): Record<string, string | number | boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^[a-zA-Z][a-zA-Z0-9_]{0,31}$/.test(k)) continue;
    if (typeof v === "string") {
      if (v.length > 500) continue;
      out[k] = v;
    } else if (typeof v === "number" && Number.isFinite(v)) {
      out[k] = v;
    } else if (typeof v === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

function parseNode(raw: unknown, index: number): SceneNode | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const type = o.type;
  if (typeof type !== "string" || !BLOCK_TYPES.has(type as BlockType)) return null;
  const id = str(o.id, `n${index}`);
  if (!ID.test(id)) return null;
  const animation = typeof o.animation === "string" && ANIMATIONS.has(o.animation as AnimationPresetId)
    ? (o.animation as AnimationPresetId)
    : "none";
  return {
    id,
    type: type as BlockType,
    x: num(o.x, 0, -200, MAX_ARTBOARD_W),
    y: num(o.y, 0, -200, MAX_ARTBOARD_H),
    w: num(o.w, 80, 8, MAX_ARTBOARD_W),
    h: num(o.h, 32, 8, MAX_ARTBOARD_H),
    rotation: num(o.rotation, 0, -180, 180),
    z: num(o.z, index, 0, 999),
    locked: o.locked === true,
    visible: o.visible !== false,
    animation,
    props: parseProps(o.props),
  };
}

/** Validate and clamp a scene. Unknown block types are dropped, never executed. */
export function parseScene(raw: unknown): EditorScene {
  const bytes = Buffer.byteLength(JSON.stringify(raw ?? {}), "utf8");
  if (bytes > MAX_SCENE_BYTES) throw new SceneError("scene exceeds size cap");
  if (!raw || typeof raw !== "object") throw new SceneError("scene is not an object");
  const o = raw as Record<string, unknown>;
  const width = num(o.width, 800, MIN_ARTBOARD, MAX_ARTBOARD_W);
  const height = num(o.height, 400, MIN_ARTBOARD, MAX_ARTBOARD_H);
  const bgRaw = o.background && typeof o.background === "object"
    ? (o.background as Record<string, unknown>)
    : {};
  const nodesIn = Array.isArray(o.nodes) ? o.nodes : [];
  if (nodesIn.length > MAX_NODES) throw new SceneError(`more than ${MAX_NODES} nodes`);
  const nodes: SceneNode[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < nodesIn.length; i++) {
    const n = parseNode(nodesIn[i], i);
    if (!n || seen.has(n.id)) continue;
    seen.add(n.id);
    nodes.push(n);
  }
  return {
    version: SCENE_VERSION,
    width,
    height,
    background: {
      fill: hex(bgRaw.fill, "#111111"),
      radius: num(bgRaw.radius, 0, 0, 48),
    },
    nodes,
  };
}

export function isHexColor(v: string): boolean {
  return HEX.test(v);
}
