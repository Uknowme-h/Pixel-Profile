import type { AnimationPresetId, SceneNode } from "@/lib/editor/types";

export interface MotionOpts {
  dur: number;
  delay: number;
  amount: number;
}

const PRESET_DUR: Record<Exclude<AnimationPresetId, "none">, number> = {
  fade: 3,
  pulse: 2,
  float: 2.4,
  spin: 6,
  wiggle: 0.7,
  drift: 7.2,
  glow: 5,
};

export const ANIMATION_PRESETS: { id: AnimationPresetId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "pulse", label: "Pulse" },
  { id: "float", label: "Float" },
  { id: "drift", label: "Drift" },
  { id: "glow", label: "Glow" },
  { id: "spin", label: "Spin" },
  { id: "wiggle", label: "Wiggle" },
];

export function defaultMotionDur(preset: AnimationPresetId | undefined): number {
  if (!preset || preset === "none") return 2;
  return PRESET_DUR[preset];
}

export function resolveMotion(node: Pick<SceneNode, "animation" | "animDur" | "animDelay" | "animAmount">): MotionOpts {
  const preset = node.animation && node.animation !== "none" ? node.animation : "pulse";
  const dur = clamp(node.animDur ?? PRESET_DUR[preset], 0.2, 20);
  const delay = clamp(node.animDelay ?? 0, 0, 12);
  const amount = clamp(node.animAmount ?? 50, 1, 100);
  return { dur, delay, amount };
}

export function usesAmount(preset: AnimationPresetId | undefined): boolean {
  return preset !== "none" && preset !== "spin" && Boolean(preset);
}

/** SMIL inside the node `<g>`. GitHub README `<img>` plays these. */
export function animationMarkup(
  preset: AnimationPresetId | undefined,
  w: number,
  h: number,
  opts?: Partial<MotionOpts>,
): string {
  if (!preset || preset === "none") return "";
  const motion = resolveMotion({ animation: preset, animDur: opts?.dur, animDelay: opts?.delay, animAmount: opts?.amount });
  const clock = smilClock(motion);
  const t = motion.amount / 50;
  const cx = (w / 2).toFixed(1);
  const cy = (h / 2).toFixed(1);

  switch (preset) {
    case "fade": {
      const lo = clamp(1 - 0.75 * t, 0.05, 0.95).toFixed(2);
      return `<animate attributeName="opacity" values="${lo};1;${lo}" ${clock}/>`;
    }
    case "pulse": {
      const lo = clamp(1 - 0.45 * t, 0.15, 0.95).toFixed(2);
      return `<animate attributeName="opacity" values="1;${lo};1" ${clock}/>`;
    }
    case "float": {
      const py = (6 * t).toFixed(1);
      return `<animateTransform attributeName="transform" type="translate" values="0 0;0 -${py};0 0" ${clock}/>`;
    }
    case "drift": {
      const dx = (16 * t).toFixed(1);
      const dy = (-11 * t).toFixed(1);
      return `<animateTransform attributeName="transform" type="translate" values="0 0;${dx} ${dy};0 0" calcMode="spline" keySplines="0.4 0 0.2 1;0.4 0 0.2 1" keyTimes="0;0.5;1" ${clock}/>`;
    }
    case "spin":
      return `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" ${clock}/>`;
    case "wiggle": {
      const deg = (4 * t).toFixed(1);
      return `<animateTransform attributeName="transform" type="rotate" values="-${deg} ${cx} ${cy};${deg} ${cx} ${cy};-${deg} ${cx} ${cy}" ${clock}/>`;
    }
    case "glow":
      return "";
    default:
      return "";
  }
}

/**
 * Wrap node internals so Glow can scale from center.
 * Other presets inject SMIL as siblings of `inner`.
 */
export function animatedInner(node: SceneNode, inner: string): string {
  const preset = node.animation;
  if (!preset || preset === "none") return inner;
  const motion = resolveMotion(node);
  if (preset === "glow") {
    const t = motion.amount / 50;
    const s = (1 + 0.18 * t).toFixed(3);
    const lo = clamp(0.85 - 0.4 * t, 0.25, 0.9).toFixed(2);
    const clock = smilClock(motion);
    const cx = node.w / 2;
    const cy = node.h / 2;
    return [
      `<g transform="translate(${cx} ${cy})">`,
      `<g>`,
      `<animateTransform attributeName="transform" type="scale" values="1;${s};1" ${clock}/>`,
      `<animate attributeName="opacity" values="0.9;${lo};0.9" ${clock}/>`,
      `<g transform="translate(${-cx} ${-cy})">${inner}</g>`,
      `</g></g>`,
    ].join("");
  }
  return `${animationMarkup(preset, node.w, node.h, motion)}${inner}`;
}

/** CSS approximation for the editor canvas (GitHub still uses SMIL). */
export function canvasMotionStyle(node: SceneNode): { className: string; style: Record<string, string> } | null {
  const preset = node.animation;
  if (!preset || preset === "none") return null;
  const { dur, delay, amount } = resolveMotion(node);
  const t = amount / 50;
  const style: Record<string, string> = {
    animationDuration: `${dur}s`,
    animationDelay: `${delay}s`,
    animationIterationCount: "infinite",
    ["--ed-n"]: String(t),
  };
  return { className: `ed-motion ed-motion-${preset}`, style };
}

function smilClock({ dur, delay }: MotionOpts): string {
  const begin = delay > 0.001 ? ` begin="${delay.toFixed(2)}s"` : "";
  return `dur="${dur.toFixed(2)}s"${begin} repeatCount="indefinite"`;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
