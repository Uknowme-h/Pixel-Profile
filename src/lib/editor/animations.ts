import type { AnimationPresetId } from "@/lib/editor/types";

/** SMIL fragments targeting the wrapping `<g id="n-…">`. GitHub README `<img>` plays these. */
export function animationMarkup(preset: AnimationPresetId | undefined, w: number, h: number): string {
  const cx = (w / 2).toFixed(1);
  const cy = (h / 2).toFixed(1);
  switch (preset) {
    case "fade":
      return `<animate attributeName="opacity" values="0.25;1;0.25" dur="3s" repeatCount="indefinite"/>`;
    case "pulse":
      return `<animate attributeName="opacity" values="1;0.55;1" dur="2s" repeatCount="indefinite"/>`;
    case "float":
      return `<animateTransform attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="2.4s" repeatCount="indefinite"/>`;
    case "spin":
      return `<animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="6s" repeatCount="indefinite"/>`;
    case "wiggle":
      return `<animateTransform attributeName="transform" type="rotate" values="-4 ${cx} ${cy};4 ${cx} ${cy};-4 ${cx} ${cy}" dur="0.7s" repeatCount="indefinite"/>`;
    default:
      return "";
  }
}

export const ANIMATION_PRESETS: { id: AnimationPresetId; label: string }[] = [
  { id: "none", label: "None" },
  { id: "fade", label: "Fade" },
  { id: "pulse", label: "Pulse" },
  { id: "float", label: "Float" },
  { id: "spin", label: "Spin" },
  { id: "wiggle", label: "Wiggle" },
];
