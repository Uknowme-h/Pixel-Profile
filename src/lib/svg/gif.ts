import { GifReader } from "omggif";
import { encodePngRgba } from "@/lib/svg/png-encode";

export const GIF_MAX_BYTES = 2_000_000;
/** Decode cap — larger uploads are scaled down, not rejected. */
export const GIF_MAX_SOURCE = 1024;
export const GIF_TARGET = 128;
export const GIF_MAX_FRAMES = 48;
/** Decode every source frame for GIF disposal; above this we still refuse. */
export const GIF_MAX_DECODE = 256;
/** Match the editor artboard cap so a GIF can fill the sheet. */
export const GIF_MAX_OUT_W = 1280;
export const GIF_MAX_OUT_H = 640;
/** RGBA filmstrip budget — large cells are scaled down so encode stays in memory. */
export const GIF_MAX_STRIP_PIXELS = 3_200_000;
/** data-URI length cap; must stay in sync with scene schema `sheet`. */
export const GIF_MAX_SHEET_CHARS = 1_200_000;

export class GifError extends Error {
  constructor(message: string) {
    super(`gif: ${message}`);
    this.name = "GifError";
  }
}

export interface GifSprite {
  /** PNG filmstrip as a data URI — one frame per cell, left to right. */
  sheet: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
  /** SMIL duration, e.g. "1.20s" */
  dur: string;
  /** Native GIF size before the 128×128 fit. */
  sourceWidth: number;
  sourceHeight: number;
  /** Native frame count before sampling down to GIF_MAX_FRAMES. */
  sourceFrames: number;
}

/**
 * Decode an animated GIF into a PNG sprite strip + timing.
 * Frames are nearest-neighbor fitted into `target` (default 128×128 contain).
 * Pass the artboard size to cover-crop the GIF as the whole sheet.
 */
export function gifToSprite(
  input: Buffer | Uint8Array,
  target?: { width: number; height: number },
): GifSprite {
  if (input.byteLength > GIF_MAX_BYTES) throw new GifError(`upload exceeds ${GIF_MAX_BYTES / 1e6}MB`);
  const bytes = input instanceof Buffer ? input : Buffer.from(input);
  if (bytes[0] !== 0x47 || bytes[1] !== 0x49 || bytes[2] !== 0x46) {
    throw new GifError("not a GIF");
  }

  let reader: GifReader;
  try {
    reader = new GifReader(bytes);
  } catch {
    throw new GifError("unreadable GIF");
  }

  const fw = reader.width;
  const fh = reader.height;
  if (fw < 1 || fh < 1) throw new GifError("invalid frame size");
  if (fw > GIF_MAX_SOURCE || fh > GIF_MAX_SOURCE) {
    throw new GifError(`frame ${fw}x${fh} exceeds the ${GIF_MAX_SOURCE}px decode cap`);
  }

  const n = reader.numFrames();
  if (n < 1) throw new GifError("no frames");
  if (n > GIF_MAX_DECODE) throw new GifError(`too many frames to decode (${n} > ${GIF_MAX_DECODE})`);

  const keep = pickKeepIndices(n, GIF_MAX_FRAMES);
  const k = keep.length;
  const keepAt = new Set(keep);

  let tw = Math.min(GIF_MAX_OUT_W, Math.max(16, Math.round(target?.width ?? GIF_TARGET)));
  let th = Math.min(GIF_MAX_OUT_H, Math.max(16, Math.round(target?.height ?? GIF_TARGET)));
  const stripPixels = tw * th * k;
  if (stripPixels > GIF_MAX_STRIP_PIXELS) {
    const scale = Math.sqrt(GIF_MAX_STRIP_PIXELS / stripPixels);
    tw = Math.max(16, Math.round(tw * scale));
    th = Math.max(16, Math.round(th * scale));
  }

  const composed = new Uint8Array(fw * fh * 4);
  let backup: Uint8Array | null = null;
  let lastDisposal = 0;
  let lastX = 0;
  let lastY = 0;
  let lastW = 0;
  let lastH = 0;
  const strip = new Uint8Array(tw * k * th * 4);
  let delaySum = 0;
  let kept = 0;

  for (let i = 0; i < n; i++) {
    const info = reader.frameInfo(i);
    if (i > 0) {
      if (lastDisposal === 2) clearRect(composed, fw, fh, lastX, lastY, lastW, lastH);
      else if (lastDisposal === 3 && backup) composed.set(backup);
    }
    if (info.disposal === 3) backup = Uint8Array.from(composed);
    try {
      reader.decodeAndBlitFrameRGBA(i, composed);
    } catch {
      throw new GifError(`failed to decode frame ${i}`);
    }
    const delay = info.delay > 0 ? info.delay : 10;
    delaySum += delay;
    if (keepAt.has(i)) {
      const fitted = fitRgba(composed, fw, fh, tw, th, target ? "cover" : "contain");
      blitFrame(strip, tw * k, tw, th, kept * tw, fitted);
      kept++;
    }
    lastDisposal = info.disposal;
    lastX = info.x;
    lastY = info.y;
    lastW = info.width;
    lastH = info.height;
  }

  const png = encodePngRgba(tw * k, th, strip);
  const durSec = Math.max(0.08, delaySum / 100);
  const fps = Math.max(1, Math.round(k / durSec));
  const dur = `${durSec.toFixed(2)}s`;
  const sheet = `data:image/png;base64,${png.toString("base64")}`;
  if (sheet.length > GIF_MAX_SHEET_CHARS) {
    throw new GifError("converted strip is too large — try a smaller GIF or fewer frames");
  }

  return {
    sheet,
    width: tw,
    height: th,
    frames: k,
    fps,
    dur,
    sourceWidth: fw,
    sourceHeight: fh,
    sourceFrames: n,
  };
}

/**
 * Fit RGBA into dw×dh. `contain` letterboxes; `cover` fills and crops.
 * Nearest-neighbor so pixel art stays crisp.
 */
export function fitRgba(
  src: Uint8Array,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
  mode: "contain" | "cover" = "contain",
): Uint8Array {
  const out = new Uint8Array(dw * dh * 4);
  if (mode === "cover") {
    const scale = Math.max(dw / sw, dh / sh);
    const srcW = dw / scale;
    const srcH = dh / scale;
    const sx0 = (sw - srcW) / 2;
    const sy0 = (sh - srcH) / 2;
    for (let y = 0; y < dh; y++) {
      const sy = Math.min(sh - 1, Math.max(0, Math.floor(sy0 + ((y + 0.5) * srcH) / dh)));
      for (let x = 0; x < dw; x++) {
        const sx = Math.min(sw - 1, Math.max(0, Math.floor(sx0 + ((x + 0.5) * srcW) / dw)));
        const si = (sy * sw + sx) * 4;
        const di = (y * dw + x) * 4;
        out[di] = src[si];
        out[di + 1] = src[si + 1];
        out[di + 2] = src[si + 2];
        out[di + 3] = src[si + 3];
      }
    }
    return out;
  }
  const scale = Math.min(dw / sw, dh / sh);
  const tw = Math.max(1, Math.round(sw * scale));
  const th = Math.max(1, Math.round(sh * scale));
  const ox = Math.floor((dw - tw) / 2);
  const oy = Math.floor((dh - th) / 2);
  for (let y = 0; y < th; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / th));
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / tw));
      const si = (sy * sw + sx) * 4;
      const di = ((y + oy) * dw + (x + ox)) * 4;
      out[di] = src[si];
      out[di + 1] = src[si + 1];
      out[di + 2] = src[si + 2];
      out[di + 3] = src[si + 3];
    }
  }
  return out;
}

function clearRect(
  buf: Uint8Array,
  fw: number,
  fh: number,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const x1 = Math.max(0, x);
  const y1 = Math.max(0, y);
  const x2 = Math.min(fw, x + w);
  const y2 = Math.min(fh, y + h);
  for (let py = y1; py < y2; py++) {
    const row = (py * fw + x1) * 4;
    buf.fill(0, row, row + (x2 - x1) * 4);
  }
}

function blitFrame(
  strip: Uint8Array,
  stripW: number,
  fw: number,
  fh: number,
  dx: number,
  frame: Uint8Array,
): void {
  for (let y = 0; y < fh; y++) {
    const src = y * fw * 4;
    const dst = (y * stripW + dx) * 4;
    strip.set(frame.subarray(src, src + fw * 4), dst);
  }
}

/** Evenly pick up to `max` indices, always including first and last. */
export function pickKeepIndices(n: number, max: number): number[] {
  if (n <= 0) return [];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  if (max <= 1) return [0];
  const out: number[] = [];
  let prev = -1;
  for (let i = 0; i < max; i++) {
    const idx = Math.round((i * (n - 1)) / (max - 1));
    if (idx !== prev) {
      out.push(idx);
      prev = idx;
    }
  }
  return out;
}

/** SMIL values list that steps the strip one frame at a time. */
export function spriteXValues(frames: number, fw: number): string {
  return Array.from({ length: frames }, (_, i) => String(-(i * fw))).join(";");
}
