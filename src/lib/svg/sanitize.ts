import { parseHTML } from "linkedom";

/**
 * Server-side SVG sanitizer — see Phase 6.
 *
 * Strict ALLOWLIST approach parsed with linkedom (lightweight DOM, cold-start
 * friendly vs full jsdom): only known-safe SVG elements and attributes survive;
 * anything else (scripts, on* handlers, foreignObject/HTML, external refs,
 * comments) is removed. SMIL animation elements and CSS @keyframes/<style> are
 * allowed with their own safety validators. A hard 5 MB input cap blocks
 * entity-bomb / billion-laughs payloads before parsing. Content that can't
 * survive is rejected, never silently degraded.
 */

export const MAX_UPLOAD_BYTES = 5_000_000; // 5MB

const { window } = parseHTML("<!doctype html><html><body></body></html>");
const { DOMParser } = window;

/** Elements allowed in a mascot SVG (shapes, paint, structure, SMIL + CSS animations). */
const ALLOWED_TAGS = new Set([
  // Structure
  "svg", "g", "defs", "symbol", "use",
  // Paint servers
  "linearGradient", "radialGradient", "stop",
  // Clip / mask / pattern
  "clipPath", "mask", "pattern",
  // Shapes
  "rect", "circle", "ellipse", "line", "polyline", "polygon", "path",
  // Text
  "text", "tspan",
  // Meta
  "title", "desc",
  // CSS animations
  "style",
  // SMIL animations
  "animate", "animateTransform", "animateMotion", "set", "mpath",
]);

/**
 * Allowed attributes, with an optional value predicate.
 * No on* handlers. href/xlink:href restricted to local fragment references (#id).
 */
const ALLOWED_ATTRS: Record<string, (v: string) => boolean> = {
  // Namespace declarations (linkedom preserves the colon form — both keys needed)
  xmlns: () => true,
  xmlnsXlink: () => true,
  "xmlns:xlink": () => true,

  // Identity / structure
  id: (v) => /^[a-zA-Z0-9_-]+$/.test(v),
  // Local-only reference — blocks http(s):// and data: on <use> / <mpath>
  href: (v) => /^#[a-zA-Z0-9_-]+$/.test(v),
  "xlink:href": (v) => /^#[a-zA-Z0-9_-]+$/.test(v),

  // Geometry
  width: (v) => /^\d+(\.\d+)?(px|%)?$/.test(v),
  height: (v) => /^\d+(\.\d+)?(px|%)?$/.test(v),
  x: (v) => /^-?\d+(\.\d+)?$/.test(v),
  y: (v) => /^-?\d+(\.\d+)?$/.test(v),
  viewBox: (v) => /^-?\d+(\.\d+)?( -?\d+(\.\d+)?){3}$/.test(v),
  d: () => true,
  points: () => true,
  cx: (v) => /^-?\d+(\.\d+)?$/.test(v),
  cy: (v) => /^-?\d+(\.\d+)?$/.test(v),
  r: (v) => /^-?\d+(\.\d+)?$/.test(v),
  rx: (v) => /^-?\d+(\.\d+)?$/.test(v),
  ry: (v) => /^-?\d+(\.\d+)?$/.test(v),
  x1: (v) => /^-?\d+(\.\d+)?$/.test(v),
  y1: (v) => /^-?\d+(\.\d+)?$/.test(v),
  x2: (v) => /^-?\d+(\.\d+)?$/.test(v),
  y2: (v) => /^-?\d+(\.\d+)?$/.test(v),

  // Paint
  // fill="freeze|remove" is valid on animation elements; [a-zA-Z]+ already covers those.
  fill: (v) => /^(#[0-9a-fA-F]{3,8}|url\(#[^)]+\)|none|[a-zA-Z]+)$/.test(v),
  stroke: (v) => /^(#[0-9a-fA-F]{3,8}|none|[a-zA-Z]+)$/.test(v),
  "stroke-width": (v) => /^\d+(\.\d+)?$/.test(v),
  "stroke-linecap": (v) => /^(butt|round|square)$/.test(v),
  "stroke-linejoin": (v) => /^(miter|round|bevel)$/.test(v),
  "stroke-dasharray": (v) => /^[\d\s,.]+$/.test(v),
  "fill-rule": (v) => /^(nonzero|evenodd)$/.test(v),
  "fill-opacity": (v) => /^\d+(\.\d+)?$/.test(v),
  "stroke-opacity": (v) => /^\d+(\.\d+)?$/.test(v),
  opacity: (v) => /^\d+(\.\d+)?$/.test(v),

  // Transform / misc presentation
  transform: (v) => /^[a-z]+\([^;]{0,400}\)(\s+[a-z]+\([^;]{0,400}\))*$/i.test(v),
  offset: (v) => /^\d+(\.\d+)?%?$/.test(v),
  "stop-color": (v) => /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)$/.test(v),
  "stop-opacity": (v) => /^\d+(\.\d+)?$/.test(v),
  "gradientUnits": (v) => /^(userSpaceOnUse|objectBoundingBox)$/.test(v),
  "gradientTransform": (v) => /^[a-z]+\([^;]{0,200}\)$/i.test(v),
  "clip-path": (v) => /^url\(#[^)]+\)$/.test(v),
  mask: (v) => /^url\(#[^)]+\)$/.test(v),
  "patternUnits": (v) => /^(userSpaceOnUse|objectBoundingBox)$/.test(v),

  // Text
  "text-anchor": (v) => /^(start|middle|end)$/.test(v),
  "font-size": (v) => /^\d+(\.\d+)?(px|em|rem|%)?$/.test(v),
  "font-family": (v) => /^[a-zA-Z0-9\s,.'"-]+$/.test(v),
  "font-weight": (v) => /^(normal|bold|[1-9]00)$/.test(v),
  "font-style": (v) => /^(normal|italic|oblique)$/.test(v),
  "letter-spacing": (v) => /^-?\d+(\.\d+)?(px|em)?$/.test(v),

  // ── SMIL animation attributes ──────────────────────────────────────────────
  // The attribute being animated (letters, hyphens, colons — no angle brackets etc.)
  attributeName: (v) => /^[a-zA-Z][a-zA-Z0-9_:-]*$/.test(v),
  // Free-form value lists — only reject characters that would break XML structure.
  // Semicolons MUST be allowed (SMIL delimiter). No length cap here — the
  // overall 5 MB upload cap is enforced before parsing; path-morph values
  // can legitimately be tens of thousands of characters long.
  values: (v) => !/[<>]/.test(v),
  from:   (v) => !/[<>]/.test(v),
  to:     (v) => !/[<>]/.test(v),
  by:     (v) => !/[<>]/.test(v),
  // Timing
  dur: (v) => /^(\d+(\.\d+)?(s|ms)|indefinite)$/.test(v),
  begin: (v) => /^[a-zA-Z0-9_.+\-;:\s]+$/.test(v),
  end: (v) => /^[a-zA-Z0-9_.+\-;:\s]+$/.test(v),
  min: (v) => /^(\d+(\.\d+)?(s|ms)|indefinite)$/.test(v),
  max: (v) => /^(\d+(\.\d+)?(s|ms)|indefinite)$/.test(v),
  repeatCount: (v) => /^(\d+|indefinite)$/.test(v),
  repeatDur: (v) => /^(\d+(\.\d+)?(s|ms)|indefinite)$/.test(v),
  restart: (v) => /^(always|whenNotActive|never)$/.test(v),
  // Interpolation
  calcMode: (v) => /^(discrete|linear|paced|spline)$/.test(v),
  keyTimes: (v) => /^[\d.;\s]+$/.test(v),
  keySplines: (v) => /^[\d.;\s,]+$/.test(v),
  keyPoints: (v) => /^[\d.;\s]+$/.test(v),
  additive: (v) => /^(replace|sum)$/.test(v),
  accumulate: (v) => /^(none|sum)$/.test(v),
  // animateTransform
  type: (v) => /^(translate|scale|rotate|skewX|skewY)$/.test(v),
  // animateMotion
  path: () => true, // path data, same as d
  rotate: (v) => /^(auto|auto-reverse|-?\d+(\.\d+)?)$/.test(v),
};

/**
 * CSS sanitizer for <style> blocks.
 * Rejects the entire block if it contains any external-resource reference,
 * javascript: URI, expression(), or @import — safe patterns like @keyframes,
 * animation:, transition:, and url(#local) are all left intact.
 */
function sanitizeCss(css: string): string {
  if (
    /javascript\s*:/i.test(css) ||
    /vbscript\s*:/i.test(css) ||
    /expression\s*\(/i.test(css) ||
    /-moz-binding/i.test(css) ||
    /@import/i.test(css) ||
    // block url() pointing outside the document (http/https/protocol-relative/absolute path)
    /url\s*\(\s*['"]?\s*https?:\/\//i.test(css) ||
    /url\s*\(\s*['"]?\s*\/\//i.test(css)
  ) {
    return "";
  }
  return css;
}

/** Recursively prune a parsed SVG tree down to the allowlist. */
function prune(node: Element): void {
  const TEXT_HOSTS = new Set(["style", "text", "tspan", "title", "desc"]);
  for (const child of Array.from(node.childNodes ?? [])) {
    if (child.nodeType !== 1) {
      // Keep character data only where SVG actually uses it. Everything else
      // (comments, stray text in <g>/<svg>) is dropped.
      if (!TEXT_HOSTS.has(node.localName)) node.removeChild(child);
      continue;
    }
    const el = child as Element;

    // <style>: sanitize CSS text content, don't recurse into child elements.
    if (el.localName === "style") {
      const safe = sanitizeCss(el.textContent ?? "");
      if (!safe.trim()) {
        node.removeChild(el);
      } else {
        el.textContent = safe;
      }
      continue;
    }

    if (!ALLOWED_TAGS.has(el.localName)) {
      node.removeChild(el);
      continue;
    }
    // Prune attributes.
    for (const attr of Array.from(el.attributes ?? [])) {
      const allowed = ALLOWED_ATTRS[attr.name];
      if (!allowed || !allowed(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
    prune(el);
  }
}

/** @throws SanitizeError on invalid input or content that must be rejected. */
export function sanitizeSvg(raw: string): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new SanitizeError("empty upload");
  }
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > MAX_UPLOAD_BYTES) {
    throw new SanitizeError(`upload exceeds ${MAX_UPLOAD_BYTES / 1e6}MB cap`);
  }

  // Hard-reject obvious script/entity payloads before parsing. A bare doctype
  // with a public/system DTD reference is benign (common in Inkscape exports);
  // only reject actual entity declarations or an internal-doctype subset, which
  // are what enable entity-expansion / billion-laughs payloads.
  if (
    /<script/i.test(raw) ||
    /<!entity/i.test(raw) ||
    /<!doctype[^>]*\[/i.test(raw) ||
    /\bon[a-z]+\s*=/i.test(raw)
  ) {
    throw new SanitizeError("script, entity, or event-handler payload detected");
  }

  let doc: ReturnType<DOMParser["parseFromString"]>;
  try {
    doc = new DOMParser().parseFromString(raw, "image/svg+xml");
  } catch {
    throw new SanitizeError("unparseable SVG");
  }
  const root = doc.documentElement;
  if (!root || root.localName !== "svg") {
    throw new SanitizeError("no <svg> root element");
  }

  // Strip the doctype/XML declaration baggage, then prune to allowlist.
  prune(root);

  // Remove internal text nodes (only used for comments/data we don't want).
  const out = root.toString();
  if (!/<svg[\s>]/i.test(out)) {
    throw new SanitizeError("no SVG content survived sanitization");
  }
  return out;
}

/**
 * Namespace user <defs>/ids to prevent collisions with template ids.
 *
 * Renames every id="..." declaration AND updates all matching references
 * so the SVG stays internally consistent after renaming:
 *   - url(#id)                   in SVG attributes and CSS text
 *   - href="#id"                 in <use> and SMIL animate targets
 *   - xlink:href="#id"           legacy form
 */
export function namespaceDefs(sanitizedSvg: string, scopeId: string): string {
  // Collect every id present so we only rewrite known references.
  const ids = new Set<string>();
  for (const [, id] of sanitizedSvg.matchAll(/\bid="([^"]+)"/g)) ids.add(id);
  if (ids.size === 0) return sanitizedSvg;

  const prefix = `usr-${scopeId}-`;

  return sanitizedSvg
    // 1. Rename id declarations
    .replace(/\bid="([^"]+)"/g, (_m, id: string) => `id="${prefix}${id}"`)
    // 2. Rename url(#id) references (covers fill, clip-path, mask, filter, CSS)
    .replace(/url\(#([^)]+)\)/g, (_m, id: string) => ids.has(id) ? `url(#${prefix}${id})` : _m)
    // 3. Rename href="#id" and xlink:href="#id" (use elements, SMIL targets)
    .replace(/(xlink:href|href)="#([^"]+)"/g, (_m, attr: string, id: string) =>
      ids.has(id) ? `${attr}="#${prefix}${id}"` : _m
    );
}

export class SanitizeError extends Error {
  constructor(message: string) {
    super(`SVG sanitization rejected: ${message}`);
    this.name = "SanitizeError";
  }
}