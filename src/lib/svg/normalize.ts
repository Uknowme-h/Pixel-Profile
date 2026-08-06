/**
 * Mascot SVG slot normalizer — see Phase 4/6.
 *
 * Rescales/repositions an uploaded SVG so it fits a template's slot region
 * without distortion (contain fit, centered), rounding to whole pixels to keep
 * grid alignment. Mutates only structure/attributes; sanitization happens
 * separately in sanitize.ts (always sanitize BEFORE rendering).
 */

export interface MascotSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface NormalizedMascot {
  /** A standalone, viewBox-preserving <svg> tightened to the rendered area. */
  svg: string;
  width: number;
  height: number;
}

function parseNumber(v: string | null | undefined, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v.trim());
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Read the effective intrinsic drawing box of an SVG root. */
function intrinsicBox(root: Element): { x: number; y: number; w: number; h: number } {
  const vb = root.getAttribute("viewBox") ?? "";
  const parts = vb.trim().split(/[\s,]+/).filter(Boolean);
  if (parts.length === 4) {
    const [x, y, w, h] = parts.map((p) => Number(p));
    if ([x, y, w, h].every((n) => Number.isFinite(n)) && w > 0 && h > 0) {
      return { x, y, w, h };
    }
  }
  return {
    x: 0,
    y: 0,
    w: parseNumber(root.getAttribute("width"), 100),
    h: parseNumber(root.getAttribute("height"), 100),
  };
}

/**
 * Wrap a (sanitized) SVG so it fits `slot`, centered, whole-pixel scale/offset.
 */
export function normalizeMascot(sanitizedSvg: string, slot: MascotSlot): NormalizedMascot {
  const src = intrinsicBoxFromString(sanitizedSvg);

  const scale = Math.min(slot.width / src.w, slot.height / src.h);
  const fitW = Math.floor(src.w * scale);
  const fitH = Math.floor(src.h * scale);
  // Center within the slot using whole pixels.
  const ox = slot.x + Math.floor((slot.width - fitW) / 2);
  const oy = slot.y + Math.floor((slot.height - fitH) / 2);

  // Rebuild a controlled root with an explicit viewBox matching the scaled box.
  const viewBox = `${src.x} ${src.y} ${src.w} ${src.h}`;
  const svg = sanitizedSvg.replace(
    /<svg[^>]*>/i,
    () =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" x="${ox}" y="${oy}" width="${fitW}" height="${fitH}" shape-rendering="crispEdges">`
  );

  return { svg, width: fitW, height: fitH };
}

function intrinsicBoxFromString(raw: string) {
  const rootEl = extractRoot(raw);
  if (rootEl) return intrinsicBox(rootEl);
  return { x: 0, y: 0, w: 100, h: 100 };
}

/** Very small regex root extractor (does not execute, just inspects markup). */
function extractRoot(raw: string): Element | null {
  const m = raw.match(/<svg[^>]*>/i);
  if (!m) return null;
  const tag = m[0];
  const el = { getAttribute: (name: string) => tag.match(new RegExp(`${name}=(["'])(.*?)\\1`))?.[2] ?? null };
  return el as unknown as Element;
}