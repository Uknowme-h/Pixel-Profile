import { describe, expect, it } from "vitest";
import { GifWriter } from "omggif";
import { gifToSprite, GifError, fitRgba, pickKeepIndices } from "@/lib/svg/gif";
import { compileScene } from "@/lib/editor/compile";

function twoFrameGif(): Buffer {
  const buf = Buffer.alloc(4096);
  const w = new GifWriter(buf, 4, 4, { loop: 0, palette: [0xff0000, 0x00ff00] });
  // Indexed pixels: 0 = red, 1 = green
  w.addFrame(0, 0, 4, 4, new Array(16).fill(0), { delay: 20, palette: [0xff0000, 0x00ff00] });
  w.addFrame(0, 0, 4, 4, new Array(16).fill(1), { delay: 20, palette: [0xff0000, 0x00ff00] });
  const end = w.end();
  return buf.subarray(0, end);
}

describe("gifToSprite", () => {
  it("turns an animated GIF into a 128×128 PNG strip", () => {
    const sprite = gifToSprite(twoFrameGif());
    expect(sprite.frames).toBe(2);
    expect(sprite.width).toBe(128);
    expect(sprite.height).toBe(128);
    expect(sprite.sourceWidth).toBe(4);
    expect(sprite.sourceHeight).toBe(4);
    expect(sprite.sheet.startsWith("data:image/png;base64,")).toBe(true);
    expect(sprite.dur).toMatch(/^\d+(\.\d+)?s$/);
  });

  it("fits into a custom artboard cell", () => {
    const sprite = gifToSprite(twoFrameGif(), { width: 800, height: 400 });
    expect(sprite.frames).toBe(2);
    expect(sprite.width).toBe(800);
    expect(sprite.height).toBe(400);
  });

  it("rejects non-gif bytes", () => {
    expect(() => gifToSprite(Buffer.from("not-a-gif"))).toThrow(GifError);
  });

  it("contain-fits a wide buffer into a square with padding", () => {
    // 4×2 opaque red
    const src = new Uint8Array(4 * 2 * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 255;
      src[i + 3] = 255;
    }
    const out = fitRgba(src, 4, 2, 8, 8);
    expect(out.length).toBe(8 * 8 * 4);
    // Top/bottom rows should stay transparent padding (2× scale → 8×4 image, 2px pad)
    expect(out[3]).toBe(0);
    const mid = ((3 * 8) + 4) * 4;
    expect(out[mid]).toBe(255);
    expect(out[mid + 3]).toBe(255);
  });

  it("cover-fills a cell with no transparent pad", () => {
    const src = new Uint8Array(4 * 2 * 4);
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 255;
      src[i + 3] = 255;
    }
    const out = fitRgba(src, 4, 2, 8, 8, "cover");
    expect(out.length).toBe(8 * 8 * 4);
    expect(out[3]).toBe(255);
    const last = (8 * 8 - 1) * 4;
    expect(out[last + 3]).toBe(255);
    expect(out[last]).toBe(255);
  });

  it("samples a long GIF down to 48 frames instead of rejecting it", () => {
    const keep = pickKeepIndices(84, 48);
    expect(keep[0]).toBe(0);
    expect(keep[keep.length - 1]).toBe(83);
    expect(keep.length).toBe(48);

    const buf = Buffer.alloc(80_000);
    const w = new GifWriter(buf, 2, 2, { loop: 0, palette: [0xff0000, 0x00ff00] });
    for (let i = 0; i < 60; i++) {
      w.addFrame(0, 0, 2, 2, new Array(4).fill(i % 2), { delay: 10, palette: [0xff0000, 0x00ff00] });
    }
    const gif = buf.subarray(0, w.end());
    const sprite = gifToSprite(gif);
    expect(sprite.sourceFrames).toBe(60);
    expect(sprite.frames).toBe(48);
    expect(sprite.dur).toMatch(/^\d+(\.\d+)?s$/);
  });
});

describe("sprite compile", () => {
  it("emits SMIL x-animation over the PNG strip", () => {
    const sprite = gifToSprite(twoFrameGif());
    const svg = compileScene({
      width: 400,
      height: 200,
      background: { fill: "#111111" },
      nodes: [
        {
          id: "nGif",
          type: "sprite",
          x: 8,
          y: 8,
          w: 128,
          h: 128,
          z: 0,
          animation: "none",
          props: {
            sheet: sprite.sheet,
            frames: sprite.frames,
            fw: sprite.width,
            fh: sprite.height,
            dur: sprite.dur,
            fps: sprite.fps,
          },
        },
      ],
    });
    expect(svg).toContain("<image");
    expect(svg).toContain('attributeName="x"');
    expect(svg).toContain("calcMode=\"discrete\"");
    expect(svg).toContain(sprite.sheet);
  });

  it("paints higher-z nodes after the sprite", () => {
    const sprite = gifToSprite(twoFrameGif());
    const svg = compileScene({
      width: 400,
      height: 200,
      background: { fill: "#111111" },
      nodes: [
        {
          id: "nGif",
          type: "sprite",
          x: 0,
          y: 0,
          w: 400,
          h: 200,
          z: 0,
          animation: "none",
          props: {
            sheet: sprite.sheet,
            frames: sprite.frames,
            fw: sprite.width,
            fh: sprite.height,
            dur: sprite.dur,
            fps: sprite.fps,
          },
        },
        {
          id: "nTxt",
          type: "text",
          x: 8,
          y: 8,
          w: 120,
          h: 40,
          z: 1,
          animation: "none",
          props: { content: "above", fill: "#f5f5f0", fontSize: 16 },
        },
      ],
    });
    expect(svg.indexOf('id="nGif"')).toBeLessThan(svg.indexOf('id="nTxt"'));
    expect(svg.indexOf('id="nTxt"')).toBeGreaterThan(-1);
  });
});
