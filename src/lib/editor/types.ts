/** Canvas editor scene graph. JSON only — no executable code. */

export const SCENE_VERSION = 1;
export const MAX_NODES = 40;
export const MAX_ARTBOARD_W = 1280;
export const MAX_ARTBOARD_H = 640;
export const MIN_ARTBOARD = 200;
export const SNAP = 8;
export const MAX_SCENE_BYTES = 1_400_000;

export type BuiltInBlockType =
  | "text"
  | "statPill"
  | "statRow"
  | "languageBar"
  | "socialButton"
  | "shape.rect"
  | "shape.ellipse"
  | "shape.line"
  | "sprite";

export type BlockType = BuiltInBlockType;

export type AnimationPresetId = "none" | "fade" | "pulse" | "float" | "spin" | "wiggle" | "drift" | "glow";

export interface SceneNode {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  z: number;
  locked?: boolean;
  visible?: boolean;
  animation?: AnimationPresetId;
  /** Seconds. Omit to use the preset default. */
  animDur?: number;
  animDelay?: number;
  /** 1–100. 50 is the preset's native travel. */
  animAmount?: number;
  props: Record<string, string | number | boolean>;
}

export interface EditorScene {
  version: typeof SCENE_VERSION;
  width: number;
  height: number;
  background: { fill: string; radius?: number };
  nodes: SceneNode[];
}

export interface CompileData {
  login: string;
  name?: string | null;
  bio?: string | null;
  totalContributions: number;
  commits: number;
  pullRequests: number;
  issues: number;
  reposContributed: number;
  languages: Record<string, number>;
  starredRepos: number;
  pinnedRepos: { name: string; description?: string | null; stars: number }[];
}

export class SceneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SceneError";
  }
}
