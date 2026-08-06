import { describe, expect, it } from "vitest";
import { sanitizeSvg, namespaceDefs, SanitizeError, MAX_UPLOAD_BYTES } from "@/lib/svg/sanitize";

/**
 * Phase 8 — sanitizer XSS corpus. Every malicious payload MUST be hard-rejected
 * (throw) or stripped — never silently passed through.
 */

describe("sanitizeSvg", () => {
  const GOOD = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#ff0000"/></svg>`;

  it("accepts a plain SVG", () => {
    expect(sanitizeSvg(GOOD)).toContain("<svg");
  });

  it("rejects embedded <script> payloads", () => {
    expect(() => sanitizeSvg(`<svg><script>alert(1)</script></svg>`)).toThrow(SanitizeError);
  });

  it("rejects on* event handler attributes", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect onload="alert(1)" width="10" height="10"/></svg>`;
    expect(() => sanitizeSvg(svg)).toThrow(SanitizeError);
  });

  it("rejects onclick/onerror handlers", () => {
    for (const attr of ["onclick", "onerror"]) {
      expect(() => sanitizeSvg(`<svg><rect ${attr}="x" width="1" height="1"/></svg>`)).toThrow(SanitizeError);
    }
  });

  it("rejects <foreignObject> (HTML smuggling)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe src="x"></iframe></foreignObject></svg>`;
    const out = sanitizeSvg(svg);
    expect(out.toLowerCase()).not.toContain("foreignobject");
    expect(out.toLowerCase()).not.toContain("iframe");
  });

  it("removes external references (xlink:href to remote)", () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><image xlink:href="https://evil.example/x.svg"/></svg>`;
    const out = sanitizeSvg(svg);
    expect(out.toLowerCase()).not.toContain("evil.example");
  });

  it("rejects an internal-doctype-subset / entity-bomb payload before parsing", () => {
    expect(() => sanitizeSvg(`<!DOCTYPE svg [<!ENTITY lol "lol">]><svg/>`)).toThrow(SanitizeError);
  });

  it("accepts a benign DOCTYPE with a public DTD reference (Inkscape export)", () => {
    const inkscape = `<?xml version="1.0" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 20010904//EN" "http://www.w3.org/TR/2001/REC-SVG-20010904/DTD/svg10.dtd">
<svg version="1.0" xmlns="http://www.w3.org/2000/svg" width="768pt" height="768pt" viewBox="0 0 768000 768000">
<g transform="translate(0,768) scale(0.1,-0.1)" fill="#000000" stroke="none">
<path d="M3200 5840 l0 -80 -80 0 -80 0 0 -160 z"/>
</g>
</svg>`;
    const out = sanitizeSvg(inkscape);
    expect(out).toContain("<svg");
    expect(out).not.toContain("DOCTYPE");
  });

  it("rejects oversized uploads (over 1MB)", () => {
    const big = "a".repeat(MAX_UPLOAD_BYTES + 100);
    expect(() => sanitizeSvg(big)).toThrow(/cap/);
  });

  it("rejects empty uploads", () => {
    expect(() => sanitizeSvg("")).toThrow(SanitizeError);
    expect(() => sanitizeSvg("   ")).toThrow(SanitizeError);
  });

  it("throws when no SVG survives sanitization", () => {
    expect(() => sanitizeSvg("hello")).toThrow(SanitizeError);
  });

  it("does not mutate valid content unexpectedly", () => {
    const out = sanitizeSvg(GOOD);
    expect(out).toContain("fill=\"#ff0000\"");
  });
});

describe("namespaceDefs", () => {
  it("prefixes all ids with the scope", () => {
    const svg = `<svg><defs><linearGradient id="grad"/></defs><rect fill="url(#grad)"/></svg>`;
    const out = namespaceDefs(svg, "user-abc123");
    expect(out).toContain('id="usr-user-abc123-grad"');
  });
});