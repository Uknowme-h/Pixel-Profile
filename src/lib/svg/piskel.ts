import { inflateSync } from "node:zlib";

/**
 * Piskel → animated inline SVG sprite — Phase 6b.
 *
 * Piskel (.piskel) files are JSON: each layer stores its frames as PNG
 * "sheets" (chunks) plus a `layout` describing where each frame lives in the
 * sheet as a [row, col] grid. This module:
 *   1. Parses + validates the JSON.
 *   2. Decodes each layer's PNG sheet with a small dependency-free decoder
 *      (Node's built-in zlib — PNG 8-bit RGB/RGBA, non-interlaced).
 *   3. Renders every frame as SVG <rect>s (horizontal runs merged) and tiles
 *      them into a horizontal strip.
 *   4. Wraps the strip in a clipped <g> with an SMIL <animateTransform> that
 *      cycles frames at the file's fps.
 *
 * The result is a self-contained, sanitizer-safe SVG (no data-URI raster
 * refs, no <image>, no scripts) that the existing static-mascot render path
 * (normalizeMascot) can embed and animate directly in all three templates.
 */

export class PiskelError extends Error {
  constructor(message: string) {
    super(`piskel: ${message}`);
    this.name = "PiskelError";
  }
}

interface PiskelChunk {
  layout: number[][];
  base64PNG: string;
}

interface PiskelLayer {
  name?: string;
  opacity?: number;
  hidden?: boolean;
  frameCount?: number;
  chunks: PiskelChunk[];
}

interface ParsedPiskel {
  width: number;
  height: number;
  fps: number;
  /** Visible layers, in paint order (later paints on top). */
  layers: PiskelLayer[];
}

const MAX_WIDTH = 128;
const MAX_HEIGHT = 128;
const MAX_FRAMES = 256;
const MAX_LAYERS = 8;

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Parse + validate the .piskel JSON structure. */
export function parsePiskel(raw: string): ParsedPiskel {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new PiskelError("not valid JSON");
  }
  if (typeof data !== "object" || data === null) throw new PiskelError("not a piskel object");
  const piskel = (data as { piskel?: unknown }).piskel;
  if (typeof piskel !== "object" || piskel === null) throw new PiskelError("missing piskel object");

  const width = num((piskel as Record<string, unknown>).width, 0);
  const height = num((piskel as Record<string, unknown>).height, 0);
  if (width < 1 || height < 1) throw new PiskelError("missing or invalid frame size");
  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    throw new PiskelError(`frame size ${width}x${height} exceeds the ${MAX_WIDTH}x${MAX_HEIGHT} cap`);
  }

  const fps = num((piskel as Record<string, unknown>).fps, 8);
  const layersRaw = (piskel as Record<string, unknown>).layers;
  if (!Array.isArray(layersRaw)) throw new PiskelError("missing layers");

  const layers: PiskelLayer[] = [];
  for (let layerRaw of layersRaw) {
    // Some exporters JSON-stringify each layer; unwrap it if so.
    if (typeof layerRaw === "string") {
      try {
        layerRaw = JSON.parse(layerRaw);
      } catch {
        continue;
      }
    }
    if (typeof layerRaw !== "object" || layerRaw === null) continue;
    const layer = layerRaw as Record<string, unknown>;
    if (layer.hidden === true) continue;
    const opacity = num(layer.opacity, 1);
    if (opacity <= 0) continue;
    if (layers.length >= MAX_LAYERS) break;

    const chunksRaw = layer.chunks;
    if (!Array.isArray(chunksRaw) || chunksRaw.length === 0) continue;

    const chunks: PiskelChunk[] = [];
    for (const chunkRaw of chunksRaw) {
      if (typeof chunkRaw !== "object" || chunkRaw === null) continue;
      const chunk = chunkRaw as Record<string, unknown>;
      if (!Array.isArray(chunk.layout) || typeof chunk.base64PNG !== "string") continue;
      if (chunk.base64PNG.trim() === "") continue;
      chunks.push({ layout: chunk.layout as number[][], base64PNG: chunk.base64PNG });
    }
    if (chunks.length === 0) continue;
    layers.push({
      name: typeof layer.name === "string" ? layer.name : undefined,
      opacity,
      frameCount: num(layer.frameCount, 0),
      chunks,
    });
  }
  if (layers.length === 0) throw new PiskelError("no visible layers");

  return { width, height, fps, layers };
}

interface DecodedSheet {
  width: number;
  height: number;
  rgba: Buffer;
}

function bppFor(colorType: number): number {
  if (colorType === 2) return 3; // RGB
  if (colorType === 6) return 4; // RGBA
  throw new PiskelError(`unsupported PNG color type ${colorType} (only RGB/RGBA 8-bit)`);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

/** Decode a PNG (8-bit, RGB/RGBA, non-interlaced) into 4-byte RGBA pixels. */
function decodePng(buf: Buffer): DecodedSheet {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIG)) throw new PiskelError("bad PNG signature");

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat: Buffer[] = [];

  let offset = 8;
  while (offset + 8 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("latin1", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + len;
    if (dataEnd + 4 > buf.length) throw new PiskelError("truncated PNG");
    const data = buf.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      if (data.length < 13) throw new PiskelError("bad IHDR");
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset = dataEnd + 4; // skip CRC
  }

  if (width < 1 || height < 1) throw new PiskelError("empty PNG");
  if (bitDepth !== 8) throw new PiskelError("unsupported PNG bit depth (only 8-bit)");
  if (interlace !== 0) throw new PiskelError("interlaced PNG not supported");
  const bpp = bppFor(colorType);

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch {
    throw new PiskelError("corrupt PNG data");
  }

  const stride = width * bpp;
  const expect = height * (stride + 1);
  if (raw.length < expect) throw new PiskelError("corrupt PNG scanlines");

  const rgba = Buffer.alloc(width * height * 4);
  let prev = Buffer.alloc(stride);
  let srcOff = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[srcOff++];
    if (filter > 4) throw new PiskelError("bad PNG filter");
    const row = Buffer.from(raw.subarray(srcOff, srcOff + stride));
    srcOff += stride;

    // Unfilter in place.
    for (let i = 0; i < stride; i++) {
      const left = i >= bpp ? row[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      switch (filter) {
        case 1: row[i] = (row[i] + left) & 0xff; break;
        case 2: row[i] = (row[i] + up) & 0xff; break;
        case 3: row[i] = (row[i] + ((left + up) >> 1)) & 0xff; break;
        case 4: row[i] = (row[i] + paeth(left, up, upLeft)) & 0xff; break;
      }
    }

    for (let x = 0; x < width; x++) {
      const si = x * bpp;
      const di = (y * width + x) * 4;
      rgba[di] = row[si];
      rgba[di + 1] = bpp > 1 ? row[si + 1] : row[si];
      rgba[di + 2] = bpp > 2 ? row[si + 2] : row[si];
      rgba[di + 3] = bpp === 4 ? row[si + 3] : 0xff;
    }
    prev = row;
  }

  return { width, height, rgba };
}

function pngHrefToBuffer(base64: string): Buffer {
  const b64 = base64.includes(",") ? base64.split(",").slice(1).join(",") : base64;
  return Buffer.from(b64, "base64");
}

function hex(v: number): string {
  return v.toString(16).padStart(2, "0");
}

/**
 * Convert a raw .piskel file into a self-animating SVG sprite.
 * Returns `{ svg, width, height, frames, fps }` where `svg` is the inline
 * fragment to embed via the static mascot path.
 */
export function piskelToAnimatedSvg(raw: string): {
  svg: string;
  width: number;
  height: number;
  frames: number;
  fps: number;
} {
  const p = parsePiskel(raw);

  // Frame count = the widest layer (Piskel layers normally match). Reject
  // absurd animations early.
  const totalFrames = Math.max(...p.layers.map((l) => l.chunks.reduce((n, c) => n + c.layout.length, 0)));
  if (totalFrames < 1) throw new PiskelError("no frames");
  if (totalFrames > MAX_FRAMES) throw new PiskelError(`too many frames (${totalFrames} > ${MAX_FRAMES})`);

  const fw = p.width;
  const fh = p.height;
  const clipId = `pi-clip-${p.width}x${p.height}x${p.fps}`;

  // Decode every layer's sheet once up front.
  const decoded = p.layers.map((l) =>
    l.chunks.map((c) => ({ sheet: decodePng(pngHrefToBuffer(c.base64PNG)), layout: c.layout }))
  );

  // Per-frame groups (ordered by frame index so layers composite correctly).
  const frameGroups: string[][] = Array.from({ length: totalFrames }, () => []);

  p.layers.forEach((layer, li) => {
    const opacity = layer.opacity ?? 1;
    let frameIdx = 0;
    for (const { sheet, layout } of decoded[li]) {
      for (const cell of layout) {
        if (frameIdx >= totalFrames) break;
        // A layout cell is a frame's grid position in the sheet. Piskel exports
        // two forms: `[x, y]` (column, row) or a single `[x]` column index with
        // y implied as 0 (frames packed in one horizontal strip).
        const col = Number(cell[0]) || 0;
        const row = Number(cell[1]) || 0;
        const ox = col * fw;
        const oy = row * fh;
        if (ox + fw > sheet.width || oy + fh > sheet.height) {
          throw new PiskelError("layer sheet smaller than declared frame grid");
        }
        frameGroups[frameIdx].push(rasterToRects(sheet, ox, oy, fw, fh, opacity));
        frameIdx++;
      }
    }
  });

  // Build the horizontal strip: frame i occupies x ∈ [i*fw, (i+1)*fw).
  const strip: string[] = [];
  frameGroups.forEach((groups, i) => {
    const xOff = i * fw;
    strip.push(`<g transform="translate(${xOff}, 0)">${groups.join("")}</g>`);
  });

  const animate =
    totalFrames > 1
      ? `<animateTransform attributeName="transform" type="translate" values="${Array.from(
          { length: totalFrames },
          (_, i) => `${-i * fw} 0`
        ).join(";")}" calcMode="discrete" dur="${(totalFrames / p.fps).toFixed(3)}s" repeatCount="indefinite"/>`
      : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fw} ${fh}" width="${fw}" height="${fh}" shape-rendering="crispEdges">` +
    `<defs><clipPath id="${clipId}"><rect width="${fw}" height="${fh}"/></clipPath></defs>` +
    `<g clip-path="url(#${clipId})">` +
    `<g>${strip.join("")}${animate}</g>` +
    `</g></svg>`;

  return { svg, width: fw, height: fh, frames: totalFrames, fps: p.fps };
}

/** Convert one fw×fw frame region of a sheet into merged horizontal <rect> runs. */
function rasterToRects(sheet: DecodedSheet, ox: number, oy: number, fw: number, fh: number, layerOpacity: number): string {
  const out: string[] = [];
  for (let py = 0; py < fh; py++) {
    const y = oy + py;
    let x = ox;
    while (x < ox + fw) {
      const di = (y * sheet.width + x) * 4;
      const a = sheet.rgba[di + 3];
      if (a === 0) {
        x++;
        continue;
      }
      const r = sheet.rgba[di];
      const g = sheet.rgba[di + 1];
      const b = sheet.rgba[di + 2];
      // Merge the horizontal run of identical color + alpha.
      let runEnd = x + 1;
      while (runEnd < ox + fw) {
        const dj = (y * sheet.width + runEnd) * 4;
        if (sheet.rgba[dj + 3] !== a || sheet.rgba[dj] !== r || sheet.rgba[dj + 1] !== g || sheet.rgba[dj + 2] !== b) break;
        runEnd++;
      }
      const alpha = Math.min(1, (a / 255) * layerOpacity);
      const fill = `#${hex(r)}${hex(g)}${hex(b)}`;
      out.push(
        alpha < 1
          ? `<rect x="${x - ox}" y="${py}" width="${runEnd - x}" height="1" fill="${fill}" fill-opacity="${alpha.toFixed(3)}"/>`
          : `<rect x="${x - ox}" y="${py}" width="${runEnd - x}" height="1" fill="${fill}"/>`
      );
      x = runEnd;
    }
  }
  return out.join("");
}
