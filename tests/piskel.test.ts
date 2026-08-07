import { describe, expect, it } from "vitest";
import { deflateSync } from "node:zlib";
import { piskelToAnimatedSvg, parsePiskel, PiskelError } from "@/lib/svg/piskel";
import { sanitizeSvg } from "@/lib/svg/sanitize";

// ── Tiny PNG encoder (8-bit RGBA, filter 0, non-interlaced) for fixtures ──

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "latin1");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width: number, height: number, rgba: number[]): string {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rawRows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      row[1 + x * 4] = rgba[i];
      row[2 + x * 4] = rgba[i + 1];
      row[3 + x * 4] = rgba[i + 2];
      row[4 + x * 4] = rgba[i + 3];
    }
    rawRows.push(row);
  }
  const idat = deflateSync(Buffer.concat(rawRows));

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([sig, pngChunk("IHDR", ihdr), pngChunk("IDAT", idat), pngChunk("IEND", Buffer.alloc(0))]).toString("base64");
}

// 4×4 sheet, 8 wide × 4 tall: frame 0 = red (opaque), frame 1 = blue (opaque).
const red = 255, green = 0, blue = 0, alpha = 255;
const BLUE = [0, 0, 255, 255];
const sheet = new Array(8 * 4 * 4).fill(0);
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 4; x++) {
    const i = (y * 8 + x) * 4;
    sheet[i] = red;
    sheet[i + 1] = green;
    sheet[i + 2] = blue;
    sheet[i + 3] = alpha;
  }
  for (let x = 4; x < 8; x++) {
    const i = (y * 8 + x) * 4;
    sheet[i] = BLUE[0];
    sheet[i + 1] = BLUE[1];
    sheet[i + 2] = BLUE[2];
    sheet[i + 3] = BLUE[3];
  }
}
const PNG = encodePng(8, 4, sheet);

const PISKEL = JSON.stringify({
  modelVersion: 2,
  piskel: {
    name: "blink",
    description: "test",
    fps: 4,
    width: 4,
    height: 4,
    layers: [
      {
        name: "Layer 1",
        opacity: 1,
        frameCount: 2,
        hidden: false,
        chunks: [{ layout: [[0, 0], [1, 0]], base64PNG: `data:image/png;base64,${PNG}` }],
      },
    ],
  },
});

describe("piskel converter", () => {
  it("parses a valid file", () => {
    const p = parsePiskel(PISKEL);
    expect(p.width).toBe(4);
    expect(p.height).toBe(4);
    expect(p.fps).toBe(4);
    expect(p.layers).toHaveLength(1);
  });

  it("handles string-wrapped layers and single-index [x] layouts (real piskel export)", () => {
    // Mirrors the format of a real .piskel export: layers[] holds JSON strings,
    // and chunk layout cells are single-value column indices.
    const sheet2 = encodePng(8, 4, sheet);
    const piskel = JSON.stringify({
      modelVersion: 2,
      piskel: {
        name: "strip",
        fps: 6,
        width: 4,
        height: 4,
        layers: [
          JSON.stringify({
            name: "Layer 1",
            opacity: 1,
            frameCount: 2,
            chunks: [{ layout: [[0], [1]], base64PNG: `data:image/png;base64,${sheet2}` }],
          }),
        ],
      },
    });
    const { svg, frames, fps, width } = piskelToAnimatedSvg(piskel);
    expect(frames).toBe(2);
    expect(fps).toBe(6);
    expect(width).toBe(4);
    expect(svg).toContain('translate(0, 0)');
    expect(svg).toContain('translate(4, 0)');
    expect(svg).toContain('values="0 0;-4 0"');
    expect(svg).toContain('dur="0.333s"');
  });

  it("rejects invalid JSON", () => {
    expect(() => parsePiskel("not json")).toThrow(PiskelError);
    expect(() => parsePiskel("")).toThrow(PiskelError);
  });

  it("rejects a file with no piskel object", () => {
    expect(() => parsePiskel('{"foo": 1}')).toThrow(/missing piskel object/);
  });

  it("rejects oversized frames", () => {
    const big = JSON.parse(PISKEL);
    big.piskel.width = 512;
    expect(() => parsePiskel(JSON.stringify(big))).toThrow(/cap/);
  });

  it("converts frames into an animated sprite", () => {
    const { svg, width, height, frames, fps } = piskelToAnimatedSvg(PISKEL);
    expect(width).toBe(4);
    expect(height).toBe(4);
    expect(frames).toBe(2);
    expect(fps).toBe(4);

    expect(svg).toContain('viewBox="0 0 4 4"');
    expect(svg).toContain("<clipPath");
    // Frame 0 at x=0 (red), frame 1 at x=4 (blue).
    expect(svg).toContain('translate(0, 0)');
    expect(svg).toContain('translate(4, 0)');
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).toContain('fill="#0000ff"');
    // Whole rows merge into single 4px runs → 4 rects per frame (the 5th
    // <rect> is the clipPath box).
    expect((svg.match(/<rect[^>]*fill="#/g) ?? []).length).toBe(8);
    // Animation cycles two frames at fps 4 → 0.500s.
    expect(svg).toContain('values="0 0;-4 0"');
    expect(svg).toContain('dur="0.500s"');
  });

  it("handles a single-frame file (no animation)", () => {
    const one = JSON.parse(PISKEL);
    one.piskel.layers[0].frameCount = 1;
    one.piskel.layers[0].chunks = [{ layout: [[0, 0]], base64PNG: one.piskel.layers[0].chunks[0].base64PNG }];
    const { svg, frames } = piskelToAnimatedSvg(JSON.stringify(one));
    expect(frames).toBe(1);
    expect(svg).not.toContain("animateTransform");
  });

  it("produces output that survives the sanitizer", () => {
    const { svg } = piskelToAnimatedSvg(PISKEL);
    const sanitized = sanitizeSvg(svg);
    expect(sanitized).toContain("<animateTransform");
    expect(sanitized).toContain("<clipPath");
    expect(sanitized).toContain('<rect width="4" height="4"');
    expect(sanitized).not.toMatch(/on[a-z]+=/i);
  });
});
