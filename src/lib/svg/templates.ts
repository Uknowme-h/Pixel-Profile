import type { RenderInput, TemplateId, ThemeColors, DefaultMascotId } from "@/types";
import { renderPixelText } from "@/lib/svg/pixel-font";
import { normalizeMascot, type MascotSlot } from "@/lib/svg/normalize";
import { SPIDEY_HREF } from "@/lib/svg/spiderman-sprite-b64";
import { HEADTURN_HREF } from "@/lib/svg/spiderman-headturn-b64";

// Web-swing sprite (pixel + arcade default): 77 frames × 82×124 px
const SPIDEY_FRAMES = 77;
const SPIDEY_FW     = 82;
const SPIDEY_FH     = 124;
const SPIDEY_DUR    = `${(SPIDEY_FRAMES / 18).toFixed(2)}s`; // 18 fps
const SPIDEY_VALS   = Array.from({ length: SPIDEY_FRAMES }, (_, i) => -(i * SPIDEY_FW)).join(";");

// Head-turn sprite (fastfetch default): 76 frames × 74×119 px
const HTURN_FRAMES = 76;
const HTURN_FW     = 74;
const HTURN_FH     = 119;
const HTURN_DUR    = `${(HTURN_FRAMES / 18).toFixed(2)}s`; // 18 fps
const HTURN_VALS   = Array.from({ length: HTURN_FRAMES }, (_, i) => -(i * HTURN_FW)).join(";");

// Official GitHub mark (Invertocat) — single path from reference/SVG/GitHub_Invertocat_Black.svg.
const GITHUB_MARK_PATH = "M56.7937 84.9688C44.4187 83.4688 35.7 74.5625 35.7 63.0313C35.7 58.3438 37.3875 53.2813 40.2 49.9063C38.9812 46.8125 39.1687 40.25 40.575 37.5313C44.325 37.0625 49.3875 39.0313 52.3875 41.75C55.95 40.625 59.7 40.0625 64.2937 40.0625C68.8875 40.0625 72.6375 40.625 76.0125 41.6563C78.9187 39.0313 84.075 37.0625 87.825 37.5313C89.1375 40.0625 89.325 46.625 88.1062 49.8125C91.1062 53.375 92.7 58.1563 92.7 63.0313C92.7 74.5625 83.9812 83.2813 71.4187 84.875C74.6062 86.9375 76.7625 91.4375 76.7625 96.5938L76.7625 106.344C76.7625 109.156 79.1062 110.75 81.9187 109.625C98.8875 103.156 112.2 86.1875 112.2 65.1875C112.2 38.6563 90.6375 17 64.1062 17C37.575 17 16.2 38.6562 16.2 65.1875C16.2 86 29.4187 103.25 47.2312 109.719C49.7625 110.656 52.2 108.969 52.2 106.438L52.2 98.9375C50.8875 99.5 49.2 99.875 47.7 99.875C41.5125 99.875 37.8562 96.5 35.2312 90.2188C34.2 87.6875 33.075 86.1875 30.9187 85.9063C29.7937 85.8125 29.4187 85.3438 29.4187 84.7813C29.4187 83.6563 31.2937 82.8125 33.1687 82.8125C35.8875 82.8125 38.2312 84.5 40.6687 87.9688C42.5437 90.6875 44.5125 91.9063 46.8562 91.9063C49.2 91.9063 50.7 91.0625 52.8562 88.9063C54.45 87.3125 55.6687 85.9063 56.7937 84.9688Z";

// Official GitHub Copilot mark — 3 paths from reference/SVG/Copilot_Icon_Black.svg.
const COPILOT_PATHS = [
  "M111.688 83.9677C108.245 89.9488 88.2522 104.062 64 104.062C39.7478 104.062 19.7554 89.9488 16.3123 83.9677C16.0605 83.5303 15.9792 83.031 15.9792 82.5263L15.9792 71.8787C15.9792 71.4373 16.0474 70.9986 16.2107 70.5885C17.6996 66.8499 21.599 61.4192 26.6313 59.9621C27.2985 58.2494 28.2867 55.7456 29.2087 53.8974C29.0543 52.4833 29 51.0248 29 49.5512C29 44.2274 30.1285 39.5576 33.5288 36.0801C35.117 34.4559 37.0876 33.21 39.4246 32.2735C45.0217 27.7264 52.992 23.9011 63.9136 23.9011C74.8352 23.9011 82.9783 27.7264 88.5754 32.2735C90.9124 33.21 92.883 34.4559 94.4712 36.0801C97.8715 39.5576 99 44.2274 99 49.5512C99 51.0248 98.9457 52.4833 98.7913 53.8974C99.7133 55.7456 100.701 58.2494 101.369 59.9621C106.401 61.4192 110.3 66.8499 111.789 70.5885C111.953 70.9986 112.021 71.4373 112.021 71.8787L112.021 82.5263C112.021 83.031 111.939 83.5303 111.688 83.9677ZM67.253 48.2606C67.0828 46.9345 67.0018 45.747 66.9995 44.686L66.9995 44.6021C67.0048 41.5242 67.6776 39.5215 68.7524 38.2914C70.1172 36.7295 72.9379 35.5328 78.8829 36.1762C84.9059 36.828 88.2725 38.3229 90.1812 40.2749C92.0291 42.1648 92.9999 44.9922 92.9999 49.5512C92.9999 54.3951 92.3018 57.2568 90.767 58.9977C89.3075 60.6531 86.4335 62 80.1386 62C75.2994 62 72.5326 60.4261 70.7637 58.2493C68.8644 55.912 67.7955 52.4878 67.253 48.2606ZM60.747 48.2606C60.9172 46.9344 60.9982 45.747 61.0005 44.686L61.0005 44.6021C60.9952 41.5242 60.3224 39.5214 59.2476 38.2914C57.8828 36.7295 55.0621 35.5328 49.1171 36.1762C43.0941 36.828 39.7275 38.3229 37.8188 40.2749C35.9709 42.1647 35.0001 44.9922 35.0001 49.5512C35.0001 54.3951 35.6982 57.2568 37.233 58.9977C38.6925 60.6531 41.5665 62 47.8614 62C52.7006 62 55.4674 60.4261 57.2363 58.2493C59.1356 55.9119 60.2045 52.4878 60.747 48.2606ZM64.6889 59.9983C64.4592 59.9995 64.9185 59.9983 64.6889 59.9983C64.4594 59.9983 63.5408 59.9995 63.3111 59.9983C62.8877 60.7075 62.4168 61.3882 61.8926 62.0332C58.8139 65.8219 54.2182 68 47.8613 68C40.9615 68 35.9049 66.564 32.7324 62.9657C32.552 62.7611 32.3906 62.5469 32.3906 62.5469L32 62.9657L32 89.3023C37.7392 92.4213 50.0576 98.0184 64 98.0184C77.9424 98.0184 90.2608 92.4213 96 89.3023L96 62.9657L95.6094 62.5469C95.6094 62.5469 95.4772 62.728 95.2676 62.9657C92.0951 66.564 87.0385 68 80.1387 68C73.7818 68 69.1861 65.8219 66.1074 62.0332C65.5832 61.3882 65.1123 60.7075 64.6889 59.9983Z",
  "M74 73C76.2091 73 78 74.7909 78 77L78 85C78 87.2092 76.2091 89 74 89C71.7909 89 70 87.2092 70 85L70 77C70 74.7909 71.7909 73 74 73Z",
  "M54 73C56.2091 73 58 74.7909 58 77L58 85C58 87.2092 56.2091 89 54 89C51.7909 89 50 87.2092 50 85L50 77C50 74.7909 51.7909 73 54 73Z",
];

/**
 * Returns the two <clipPath> defs (webswing + headturn) for a given template
 * prefix. Both are always emitted so any user selection renders without error.
 */
function spideyClipDefs(prefix: string): string[] {
  return [
    `<clipPath id="${prefix}-webswing"><rect x="0" y="0" width="${SPIDEY_FW}" height="${SPIDEY_FH}"/></clipPath>`,
    `<clipPath id="${prefix}-headturn"><rect x="0" y="0" width="${HTURN_FW}"  height="${HTURN_FH}"/></clipPath>`,
  ];
}

/**
 * Renders the animated sprite into a given slot. Returns an empty array when
 * the user has chosen "none". Scales by height to fill the slot.
 */
function spideySprite(
  choice: DefaultMascotId,
  prefix: string,
  slot: { x: number; y: number; w: number; h: number }
): string[] {
  if (choice === "none") return [];
  const isSwing = choice === "webswing";
  if (!isSwing && choice !== "headturn") return [];
  const fw = isSwing ? SPIDEY_FW : HTURN_FW;
  const fh = isSwing ? SPIDEY_FH : HTURN_FH;
  const frames = isSwing ? SPIDEY_FRAMES : HTURN_FRAMES;
  const vals  = isSwing ? SPIDEY_VALS  : HTURN_VALS;
  const dur   = isSwing ? SPIDEY_DUR   : HTURN_DUR;
  const href  = isSwing ? SPIDEY_HREF  : HEADTURN_HREF;
  const scale  = slot.h / fh;
  const dispW  = Math.round(fw * scale);
  const sx     = slot.x + Math.floor((slot.w - dispW) / 2);
  return [
    `<g transform="translate(${sx}, ${slot.y}) scale(${scale.toFixed(4)})" shape-rendering="crispEdges" opacity="0.93">`,
    `<g clip-path="url(#${prefix}-${choice})">`,
    `<image href="${href}" width="${frames * fw}" height="${fh}" x="0" y="0">`,
    `<animate attributeName="x" values="${vals}" dur="${dur}" repeatCount="indefinite" calcMode="discrete"/>`,
    `</image>`,
    `</g>`,
    `</g>`,
  ];
}

/**
 * Renders a static logo mascot (GitHub mark / Copilot icon) into a given slot.
 * Uniformly scaled to fit, centered, and colored with `fill`.
 */
function staticMascot(
  choice: DefaultMascotId,
  slot: { x: number; y: number; w: number; h: number },
  fill: string
): string {
  const VB_W = 128;
  const VB_H = 128;
  const paths = choice === "copilot" ? COPILOT_PATHS : [GITHUB_MARK_PATH];
  const scale = Math.min(slot.w / VB_W, slot.h / VB_H);
  const dispW = VB_W * scale;
  const dispH = VB_H * scale;
  const sx = slot.x + Math.floor((slot.w - dispW) / 2);
  const sy = slot.y + Math.floor((slot.h - dispH) / 2);
  const body = paths.map((d) => `<path d="${d}"/>`).join("");
  return `<g transform="translate(${sx}, ${sy}) scale(${scale.toFixed(4)})" fill="${fill}" opacity="0.95">${body}</g>`;
}

/**
 * Unified dispatcher: animated sprite for webswing/headturn, static GitHub
 * logo for github/copilot, nothing for none.
 */
function renderMascot(
  choice: DefaultMascotId,
  prefix: string,
  slot: { x: number; y: number; w: number; h: number },
  fill: string
): string[] {
  if (choice === "github" || choice === "copilot") {
    return [staticMascot(choice, slot, fill)];
  }
  return spideySprite(choice, prefix, slot);
}

/**
 * Phase 4 — SVG template engine (redesigned).
 *
 * Three templates: pixel (compact pixel-art), fastfetch (macOS terminal),
 * arcade (retro CRT RPG). Each has a fixed palette, layout, and animations.
 * Only pixel respects the user's ThemeColors; the other two own their palette.
 */

export interface TemplateDef {
  id: TemplateId;
  label: string;
  description: string;
  viewBox: string;
  width: number;
  height: number;
  mascotSlot: MascotSlot;
  render: (input: RenderInput) => string;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function cut(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/** Top-N languages normalized to 0..100 relative to the top language. */
function topLangs(data: RenderInput["data"], n: number): { name: string; pct: number }[] {
  const entries = Object.entries(data.languages ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n);
  const max = entries[0]?.[1] ?? 1;
  return entries.map(([name, v]) => ({ name, pct: max > 0 ? Math.round((v / max) * 100) : 0 }));
}

function topLang(data: RenderInput["data"]): string | null {
  return (
    Object.entries(data.languages ?? {}).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  );
}

/** Bar fill width (pixels) capped to maxW, with a soft-cap for visual balance. */
function barFill(value: number, softMax: number, maxW: number): number {
  return Math.max(1, Math.min(maxW, Math.floor((value / softMax) * maxW)));
}

function fmt(n: number): string {
  return n.toLocaleString("en-US");
}

/** Map a BarStyle string to the numeric style slot used by animateBar. */
function getAnimStyleNum(style: string | null | undefined): number | undefined {
  if (!style) return undefined;
  const map: Record<string, number> = { "ease-out": 0, bounce: 1, linear: 2, step: 3 };
  const n = map[style];
  return n !== undefined ? n : undefined;
}

/**
 * Returns a SMIL <animate> element for a bar fill-in, varying the easing
 * style by index so bars within the same card feel distinct.
 *
 * Styles (cycle by index % 4):
 *  0 — ease-out  : fast start, decelerates
 *  1 — bounce    : overshoots briefly then settles
 *  2 — linear    : steady, no-frills
 *  3 — step      : discrete jumps (retro XP-bar feel)
 *
 * @param fillW  Final bar width in pixels
 * @param index  Bar index (0-based) — drives style + stagger
 * @param begin  Animation begin offset in seconds
 * @param maxW   Max allowed pixel width (caps bounce overshoot)
 */
function animateBar(fillW: number, index: number, begin: number, maxW = fillW, styleOverride?: number): string {
  const b = `begin="${begin.toFixed(2)}s" fill="freeze"`;
  const style = styleOverride !== undefined ? styleOverride : (index % 4);
  if (style === 0) {
    // ease-out
    return `<animate attributeName="width" from="0" to="${fillW}" dur="0.55s" ${b} calcMode="spline" keyTimes="0;1" keySplines="0,0,0.2,1"/>`;
  }
  if (style === 1) {
    // bounce-settle: overshoot ~10% then pull back to final
    const over = Math.min(maxW, Math.round(fillW * 1.10));
    const back = Math.round(fillW * 0.97);
    return `<animate attributeName="width" values="0;${over};${back};${fillW}" keyTimes="0;0.62;0.82;1" dur="0.72s" ${b} calcMode="spline" keySplines="0.4,0,0.6,1;0.4,0,0.6,1;0.4,0,0.6,1"/>`;
  }
  if (style === 2) {
    // linear
    return `<animate attributeName="width" from="0" to="${fillW}" dur="0.45s" ${b}/>`;
  }
  // step: four discrete jumps — retro XP-bar feel
  const q1 = Math.round(fillW * 0.30);
  const q2 = Math.round(fillW * 0.60);
  const q3 = Math.round(fillW * 0.85);
  return `<animate attributeName="width" values="0;${q1};${q2};${q3};${fillW}" keyTimes="0;0.25;0.5;0.75;1" dur="0.64s" ${b} calcMode="discrete"/>`;
}

// ─── Fastfetch palette ────────────────────────────────────────────────────────
const FF = {
  bg:       "#161618",
  panel:    "#1a1a1c",
  tbTop:    "#3a3a3c",
  tbBot:    "#2c2c2e",
  red:      "#ff5f57",
  yellow:   "#febc2e",
  green:    "#28c840",
  blue:     "#5ac8fa",
  purple:   "#af52de",
  orange:   "#ff9f0a",
  text:     "#e5e5e7",
  muted:    "#8e8e93",
  faint:    "#3a3a3d",
  key:      "#febc2e",
  barBg:    "#2a2a2d",
  divider:  "#2c2c2e",
} as const;

function renderFastfetch(input: RenderInput): string {
  const { theme, fields, data, mascotSvg } = input;
  // Theme overrides: accent=highlight, fg=primary text, muted=secondary text, bg=window bg.
  // Traffic lights, key labels (FF.key), and structural colors stay fixed.
  const tAccent = theme.accent;
  const tFg     = theme.fg;
  const tMuted  = theme.muted;
  const tBg     = theme.bg;
  const tPanel  = adjustBrightness(theme.bg, 6);   // right panel slightly lighter
  const W = 1020;
  const H = 560;

  const login    = esc(data.login || "user");
  const name     = esc(cut(fields.name || data.name || data.login, 30));
  const bio      = esc(cut(fields.role || data.bio || "developer", 58));
  const stars    = fmt(data.starredRepos ?? 0);
  const langs    = topLangs(data, 5);
  const pinned   = (data.pinnedRepos ?? []).slice(0, 3);
  const mono     = "Menlo, Monaco, Consolas, monospace";

  // If the per-type columns are missing (migration not yet run on live DB),
  // fall back to totalContributions as a single "Contributions" value.
  const hasBreakdown = (data.commits ?? 0) + (data.pullRequests ?? 0) + (data.issues ?? 0) > 0
    || data.totalContributions === 0;
  const rawCommits = data.commits ?? 0;
  const rawPrs     = data.pullRequests ?? 0;
  const rawIssues  = data.issues ?? 0;
  const rawRepos   = data.reposContributed ?? 0;
  const commits    = fmt(rawCommits);
  const prs        = fmt(rawPrs);
  const issues     = fmt(rawIssues);
  const repos      = fmt(rawRepos);

  const swatchColors = [FF.red, FF.yellow, FF.green, FF.blue, FF.purple, FF.orange, FF.text, "#6e6e73"];

  const p: string[] = [];

  p.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub profile card for ${login}">`,
    `<defs>`,
    // Drop shadow
    `<filter id="ff-shadow" x="-5%" y="-5%" width="110%" height="120%">`,
    `<feDropShadow dx="0" dy="10" stdDeviation="18" flood-color="#000" flood-opacity="0.5"/>`,
    `</filter>`,
    // Titlebar gradient
    `<linearGradient id="ff-tb" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${FF.tbTop}"/>`,
    `<stop offset="100%" stop-color="${FF.tbBot}"/>`,
    `</linearGradient>`,
    // Rounded clip
    `<clipPath id="ff-clip"><rect x="0" y="0" width="${W}" height="${H}" rx="12" ry="12"/></clipPath>`,
    // Sprite clip windows (both sprites; used by whichever defaultMascot the user chose)
    ...spideyClipDefs("ff"),
    `</defs>`,
  );

  // Shadow base
  p.push(`<g filter="url(#ff-shadow)"><g clip-path="url(#ff-clip)">`);

  // Background
  p.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="${tBg}"/>`);

  // Title bar
  p.push(
    `<rect x="0" y="0" width="${W}" height="38" fill="url(#ff-tb)"/>`,
    `<circle cx="24" cy="19" r="7" fill="${FF.red}"/>`,
    `<circle cx="46" cy="19" r="7" fill="${FF.yellow}"/>`,
    `<circle cx="68" cy="19" r="7" fill="${FF.green}"/>`,
    `<text x="510" y="25" text-anchor="middle" font-family="${mono}" font-size="13" fill="#c7c7c9">${login} — fastfetch</text>`,
  );

  // Left panel: mascot
  if (mascotSvg) {
    const fitted = normalizeMascot(mascotSvg, { x: 14, y: 44, width: 334, height: 498 });
    p.push(fitted.svg);
  } else {
    // Default mascot: user's choice, falling back to "headturn" for fastfetch
    const dm = (input.defaultMascot ?? "headturn") as DefaultMascotId;
    p.push(...renderMascot(dm, "ff", { x: 14, y: 44, w: 334, h: 498 }, tFg));
  }

  // Vertical divider
  p.push(`<line x1="362" y1="38" x2="362" y2="${H}" stroke="${FF.divider}" stroke-width="1"/>`);

  // Right info panel background
  p.push(`<rect x="363" y="38" width="${W - 363}" height="${H - 38}" fill="${tPanel}"/>`);

  // ── Right panel content ──
  const rx = 390; // content left edge

  // Header: name@github
  p.push(
    `<text x="${rx}" y="76" font-family="${mono}" font-size="18" font-weight="bold">`,
    `<tspan fill="${tAccent}">${name}</tspan><tspan fill="${tMuted}">@</tspan><tspan fill="${tAccent}">${login}</tspan>`,
    `</text>`,
    `<text x="${rx}" y="92" font-family="${mono}" font-size="11" fill="${FF.faint}">${"─".repeat(46)}</text>`,
  );

  // Info rows helper
  let ry = 118;
  const row = (key: string, val: string, valColor = tFg) => {
    p.push(
      `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="13">`,
      `<tspan fill="${FF.key}" font-weight="bold">${esc(key)}</tspan>`,
      `<tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${valColor}">${esc(val)}</tspan>`,
      `</text>`,
    );
    ry += 24;
  };

  row("Bio", bio);

  // Contributions row — show breakdown if available, otherwise total
  if (hasBreakdown) {
    p.push(
      `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="13">`,
      `<tspan fill="${FF.key}" font-weight="bold">Commits</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${FF.green}" font-weight="bold">${commits}</tspan>`,
      `<tspan fill="${FF.faint}">  ·  </tspan>`,
      `<tspan fill="${FF.key}" font-weight="bold">PRs</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${tAccent}" font-weight="bold">${prs}</tspan>`,
      `<tspan fill="${FF.faint}">  ·  </tspan>`,
      `<tspan fill="${FF.key}" font-weight="bold">Issues</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${FF.orange}" font-weight="bold">${issues}</tspan>`,
      `<tspan fill="${FF.faint}" font-size="11">  (12 mo)</tspan>`,
      `</text>`,
    );
    ry += 24;
    p.push(
      `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="13">`,
      `<tspan fill="${FF.key}" font-weight="bold">Stars</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${FF.yellow}" font-weight="bold">★ ${stars}</tspan>`,
      `<tspan fill="${FF.faint}">  ·  </tspan>`,
      `<tspan fill="${FF.key}" font-weight="bold">Repos</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${tFg}">${repos}</tspan>`,
      `</text>`,
    );
  } else {
    // Migration not yet run — show total contributions + stars as a single row
    p.push(
      `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="13">`,
      `<tspan fill="${FF.key}" font-weight="bold">Contributions</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${FF.green}" font-weight="bold">${fmt(data.totalContributions ?? 0)}</tspan>`,
      `<tspan fill="${FF.faint}">  ·  </tspan>`,
      `<tspan fill="${FF.key}" font-weight="bold">Stars</tspan><tspan fill="${tMuted}">: </tspan>`,
      `<tspan fill="${FF.yellow}" font-weight="bold">★ ${stars}</tspan>`,
      `</text>`,
    );
  }
  ry += 28;

  // Language section header
  p.push(
    `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="10" fill="${tMuted}" letter-spacing="2">LANGUAGES</text>`,
  );
  ry += 4;
  p.push(
    `<text x="${rx}" y="${ry + 10}" font-family="${mono}" font-size="11" fill="${FF.faint}">${"─".repeat(44)}</text>`,
  );
  ry += 20;

  // Language bars — ANSI palette by default; overrideable per-bar via fields.barColors
  const barAreaW = 110;
  const labelW   = 90;
  const barX     = rx + labelW + 8;
  const ffDefaultColors = [FF.blue, FF.purple, FF.orange, FF.green, FF.red];
  const ffAnimStyle = getAnimStyleNum(input.fields.barAnimation);

  langs.forEach((l, i) => {
    const fillW = Math.max(1, Math.floor((l.pct / 100) * barAreaW));
    const pct   = l.pct + "%";
    const bColor = input.fields.barColors?.[i] ?? ffDefaultColors[i % ffDefaultColors.length];
    p.push(
      `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="12" fill="${tMuted}">${esc(cut(l.name, 11))}</text>`,
      `<rect x="${barX}" y="${ry - 11}" width="${barAreaW}" height="11" rx="2" fill="${FF.barBg}"/>`,
      `<rect x="${barX}" y="${ry - 11}" width="0" height="11" rx="2" fill="${bColor}" opacity="0.85">`,
      animateBar(fillW, i, i * 0.16, barAreaW, ffAnimStyle),
      `</rect>`,
      `<text x="${barX + barAreaW + 8}" y="${ry}" font-family="${mono}" font-size="11" fill="${tMuted}">${pct}</text>`,
    );
    ry += 22;
  });

  ry += 8;

  // Pinned repos section
  if (pinned.length > 0) {
    p.push(
      `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="10" fill="${tMuted}" letter-spacing="2">PINNED</text>`,
    );
    ry += 4;
    p.push(
      `<text x="${rx}" y="${ry + 10}" font-family="${mono}" font-size="11" fill="${FF.faint}">${"─".repeat(44)}</text>`,
    );
    ry += 20;

    for (const repo of pinned) {
      p.push(
        `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="13">`,
        `<tspan fill="${tAccent}">✦</tspan>`,
        `<tspan fill="${tFg}"> ${esc(cut(repo.name, 24))}</tspan>`,
        `<tspan fill="${tMuted}">  ★ ${repo.stars ?? 0}</tspan>`,
        `</text>`,
      );
      ry += 22;
    }
    ry += 6;
  }

  // Color swatch row
  const swY = ry;
  swatchColors.forEach((c, i) => {
    p.push(`<rect x="${rx + i * 22}" y="${swY}" width="16" height="16" rx="2" fill="${c}"/>`);
  });
  ry += 36;

  // Terminal prompt with blinking cursor
  const promptText = `${login}@github:~$\u00a0`;
  p.push(
    `<text x="${rx}" y="${ry}" font-family="${mono}" font-size="14">`,
    `<tspan fill="${FF.green}">${login}</tspan>`,
    `<tspan fill="${tMuted}">@github</tspan>`,
    `<tspan fill="${tFg}">:~$ </tspan>`,
    `<tspan fill="${tFg}">▌<animate attributeName="opacity" values="1;1;0;0;1" keyTimes="0;0.45;0.5;0.95;1" dur="1.2s" repeatCount="indefinite"/></tspan>`,
    `</text>`,
  );
  void promptText;

  p.push(`</g></g></svg>`);
  return p.join("\n");
}

// ─── Arcade palette ───────────────────────────────────────────────────────────
const AC = {
  outer:    "#020814",
  bgTop:    "#0f2545",
  bgBot:    "#0a1830",
  panTop:   "#12345f",
  panBot:   "#0d2749",
  border:   "#3fd0ff",
  dim:      "#8fd8ff",
  gold:     "#febc2e",
  text:     "#d8f2ff",
  sub:      "#5a7fa0",
  barBg:    "#0a1830",
  barStr:   "#28c840",   // STR = commits → green health
  barDex:   "#af52de",   // DEX = PRs → purple agility
  barWis:   "#ff9f0a",   // WIS = issues → orange wisdom
  barCon:   "#5ac8fa",   // CON = repos → blue endurance
  skin:     "#ffcf8a",
} as const;

function renderArcade(input: RenderInput): string {
  const { theme, fields, data, mascotSvg } = input;
  // Theme overrides: accent=CRT border/glow, fg=primary text, muted=dim secondary text, bg=background.
  // RPG bar colors (green/purple/orange/blue), gold labels, and panel depth stay fixed.
  const tAccent = theme.accent;
  const tFg     = theme.fg;
  const tMuted  = theme.muted;
  const tBgTop  = adjustBrightness(theme.bg, 20);  // lighter gradient top
  const tBgBot  = theme.bg;
  const tOuter  = adjustBrightness(theme.bg, -25); // darker outer bezel
  const W = 1000;
  const H = 640;

  const loginRaw  = data.login || "user";
  const login     = esc(loginRaw.toUpperCase());
  const loginLo   = esc(loginRaw);
  const nameRaw   = cut(fields.name || data.name || data.login, 22);
  const name      = esc(nameRaw.toUpperCase());
  const bio       = esc(cut(fields.role || data.bio || "developer", 46));
  const contribs  = data.totalContributions ?? 0;
  const stars     = data.starredRepos ?? 0;

  // Degrade gracefully when per-type columns not yet in DB (all default to 0).
  // If breakdown is unavailable but totalContributions > 0, use totalContributions
  // for STR and leave DEX/WIS/CON at 0 — still shows relative bars correctly.
  const hasBreakdown = (data.commits ?? 0) + (data.pullRequests ?? 0) + (data.issues ?? 0) > 0
    || contribs === 0;
  const commits   = hasBreakdown ? (data.commits ?? 0) : contribs;
  const prs       = hasBreakdown ? (data.pullRequests ?? 0) : 0;
  const issues    = hasBreakdown ? (data.issues ?? 0) : 0;
  const repos     = hasBreakdown ? (data.reposContributed ?? 0) : 0;
  const langs     = topLangs(data, 5);
  const pinned    = (data.pinnedRepos ?? []).slice(0, 5);
  const top       = topLang(data);
  const level     = Math.min(99, Math.floor(Math.sqrt(contribs)));
  const mono      = "'Courier New', Courier, monospace";

  const p: string[] = [];

  p.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub profile card for ${loginLo}">`,
    `<defs>`,
    // Background gradient
    `<linearGradient id="ac-bg" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${tBgTop}"/><stop offset="100%" stop-color="${tBgBot}"/>`,
    `</linearGradient>`,
    // Panel gradient
    `<linearGradient id="ac-pan" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${AC.panTop}"/><stop offset="100%" stop-color="${AC.panBot}"/>`,
    `</linearGradient>`,
    // Glow filter for title + borders
    `<filter id="ac-glow" x="-20%" y="-20%" width="140%" height="140%">`,
    `<feGaussianBlur stdDeviation="2.4" result="blur"/>`,
    `<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>`,
    `</filter>`,
    // Subtle scanline pattern
    `<pattern id="ac-scan" x="0" y="0" width="${W}" height="4" patternUnits="userSpaceOnUse">`,
    `<rect x="0" y="0" width="${W}" height="1" fill="#000" opacity="0.18"/>`,
    `</pattern>`,
    // Sprite clip windows (both sprites; used by whichever defaultMascot the user chose)
    ...spideyClipDefs("ac"),
    `</defs>`,
  );

  // CRT bezel frame
  p.push(
    `<rect x="0" y="0" width="${W}" height="${H}" rx="6" fill="${tOuter}"/>`,
    `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="url(#ac-bg)" stroke="${tAccent}" stroke-width="2.5"/>`,
    `<rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="url(#ac-scan)" opacity="1"/>`,
  );

  // Moving scanline highlight (CRT sweep)
  p.push(
    `<rect x="8" y="8" width="${W - 16}" height="5" fill="${tAccent}" opacity="0.06">`,
    `<animateTransform attributeName="transform" type="translate" values="0,0;0,${H - 16};0,0" dur="5s" repeatCount="indefinite"/>`,
    `</rect>`,
  );

  // Title bar
  p.push(
    `<rect x="8" y="8" width="${W - 16}" height="56" fill="url(#ac-pan)" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="500" y="46" text-anchor="middle" font-family="${mono}" font-size="24" font-weight="bold" letter-spacing="4" fill="${tAccent}" filter="url(#ac-glow)">`,
    `${name}.EXE — PLAYER PROFILE`,
    `<animate attributeName="opacity" values="1;0.88;1;0.92;1" dur="2.4s" repeatCount="indefinite"/>`,
    `</text>`,
  );

  // ── LEFT COLUMN ──────────────────────────────────────────────────────────────
  const lx = 28;
  const lw = 308;

  // CHARACTER SELECT frame
  const charY = 76;
  const charH = 290;
  p.push(
    `<rect x="${lx}" y="${charY}" width="${lw}" height="${charH}" fill="url(#ac-pan)" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="${lx + lw / 2}" y="${charY + 20}" text-anchor="middle" font-family="${mono}" font-size="11" fill="${tMuted}" letter-spacing="3">CHARACTER SELECT</text>`,
  );

  if (mascotSvg) {
    const fitted = normalizeMascot(mascotSvg, { x: lx + 34, y: charY + 30, width: lw - 68, height: charH - 56 });
    p.push(fitted.svg);
  } else {
    // Default mascot: user's choice, falling back to "webswing" for arcade
    const dm = (input.defaultMascot ?? "webswing") as DefaultMascotId;
    p.push(...renderMascot(dm, "ac", { x: lx + 34, y: charY + 30, w: lw - 68, h: charH - 56 }, tFg));
  }

  // Name / class below char select frame
  const nameY = charY + charH + 18;
  p.push(
    `<text x="${lx + lw / 2}" y="${nameY}" text-anchor="middle" font-family="${mono}" font-size="18" font-weight="bold" fill="${tAccent}">${name}</text>`,
    `<text x="${lx + lw / 2}" y="${nameY + 20}" text-anchor="middle" font-family="${mono}" font-size="11" fill="${tMuted}">CLASS: ${esc(bio.substring(0, 30).toUpperCase())}</text>`,
    `<text x="${lx + lw / 2}" y="${nameY + 38}" text-anchor="middle" font-family="${mono}" font-size="12" fill="${AC.gold}">LVL ${level} · ${esc((top ?? "GITHUB").toUpperCase())}</text>`,
    `<text x="${lx + lw / 2}" y="${nameY + 56}" text-anchor="middle" font-family="${mono}" font-size="11" fill="${AC.sub}">★ ${fmt(stars)} STARS EARNED</text>`,
  );

  // SKILLS frame (languages as XP bars)
  const skillsY = nameY + 72;
  const skillsH = H - 56 - skillsY;
  p.push(
    `<rect x="${lx}" y="${skillsY}" width="${lw}" height="${skillsH}" fill="url(#ac-pan)" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="${lx + 16}" y="${skillsY + 20}" font-family="${mono}" font-size="11" fill="${tMuted}" letter-spacing="3">SKILLS</text>`,
    `<line x1="${lx + 16}" y1="${skillsY + 27}" x2="${lx + lw - 16}" y2="${skillsY + 27}" stroke="${tAccent}" stroke-width="0.5" opacity="0.4"/>`,
  );

  const skillBarW  = 138;
  const skillLabelX = lx + 16;
  const skillBarX   = lx + lw - skillBarW - 20;

  const acAnimStyle = getAnimStyleNum(input.fields.barAnimation);
  const acDefaultSkillColors = [tAccent, AC.gold, AC.barDex, AC.barWis, AC.barCon];

  langs.slice(0, Math.min(5, Math.floor((skillsH - 46) / 26))).forEach((l, i) => {
    const sy    = skillsY + 44 + i * 26;
    const fillW = Math.max(1, Math.floor((l.pct / 100) * skillBarW));
    const barFillColor = input.fields.barColors?.[i] ?? acDefaultSkillColors[i] ?? tAccent;
    p.push(
      `<text x="${skillLabelX}" y="${sy}" font-family="${mono}" font-size="11" fill="${tMuted}">${esc(cut(l.name, 10).toUpperCase())}</text>`,
      `<rect x="${skillBarX}" y="${sy - 11}" width="${skillBarW}" height="12" fill="${AC.barBg}" stroke="${tAccent}" stroke-width="0.8"/>`,
      `<rect x="${skillBarX + 1}" y="${sy - 10}" width="0" height="10" fill="${barFillColor}" opacity="0.9">`,
      animateBar(fillW, i, i * 0.15, skillBarW, acAnimStyle),
      `</rect>`,
      `<text x="${skillBarX + skillBarW + 4}" y="${sy}" font-family="${mono}" font-size="10" fill="${AC.sub}">${l.pct}%</text>`,
    );
  });

  // ── RIGHT COLUMN ─────────────────────────────────────────────────────────────
  const rx = 352;
  const rw = W - rx - 24;

  // STATUS frame
  const statusY = 76;
  const statusH = 210;
  p.push(
    `<rect x="${rx}" y="${statusY}" width="${rw}" height="${statusH}" fill="url(#ac-pan)" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="${rx + 16}" y="${statusY + 20}" font-family="${mono}" font-size="11" fill="${tMuted}" letter-spacing="3">STATUS</text>`,
    `<line x1="${rx + 16}" y1="${statusY + 27}" x2="${rx + rw - 16}" y2="${statusY + 27}" stroke="${tAccent}" stroke-width="0.5" opacity="0.4"/>`,
  );

  // ROLE row
  p.push(
    `<text x="${rx + 16}" y="${statusY + 48}" font-family="${mono}" font-size="13">`,
    `<tspan fill="${AC.gold}" font-weight="bold">ROLE</tspan><tspan fill="${AC.sub}">: </tspan>`,
    `<tspan fill="${tFg}">${bio}</tspan>`,
    `</text>`,
  );

  // RPG stat bars
  const statBarW  = 160;
  const statBarX  = rx + 140;
  const statNumX  = rx + rw - 20;
  const stats: { label: string; val: number; softMax: number; color: string; unit: string }[] = [
    { label: "STR", val: commits, softMax: 2000, color: AC.barStr, unit: hasBreakdown ? "COMMITS (12 MO)" : "CONTRIBUTIONS (12 MO)" },
    { label: "DEX", val: prs,     softMax: 200,  color: AC.barDex, unit: "PULL REQUESTS (12 MO)" },
    { label: "WIS", val: issues,  softMax: 100,  color: AC.barWis, unit: "ISSUES (12 MO)" },
    { label: "CON", val: repos,   softMax: 50,   color: AC.barCon, unit: "REPOS CONTRIBUTED" },
  ];

  stats.forEach((s, i) => {
    const sy   = statusY + 72 + i * 34;
    const fill = barFill(s.val, s.softMax, statBarW - 2);
    p.push(
      `<text x="${rx + 16}" y="${sy}" font-family="${mono}" font-size="12" fill="${AC.gold}" font-weight="bold">${s.label}</text>`,
      `<rect x="${statBarX}" y="${sy - 12}" width="${statBarW}" height="14" fill="${AC.barBg}" stroke="${tAccent}" stroke-width="0.8"/>`,
      `<rect x="${statBarX + 1}" y="${sy - 11}" width="0" height="12" fill="${s.color}" opacity="0.9">`,
      animateBar(fill, i, i * 0.15, statBarW - 2, acAnimStyle),
      `</rect>`,
      `<text x="${statNumX}" y="${sy}" text-anchor="end" font-family="${mono}" font-size="11" fill="${tMuted}">${fmt(s.val)} ${s.unit}</text>`,
    );
  });

  // QUEST LOG frame
  const questY = statusY + statusH + 12;
  const questRows = Math.max(1, pinned.length);
  const questH = 48 + questRows * 26 + 10;
  p.push(
    `<rect x="${rx}" y="${questY}" width="${rw}" height="${questH}" fill="url(#ac-pan)" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="${rx + 16}" y="${questY + 20}" font-family="${mono}" font-size="11" fill="${tMuted}" letter-spacing="3">QUEST LOG</text>`,
    `<line x1="${rx + 16}" y1="${questY + 27}" x2="${rx + rw - 16}" y2="${questY + 27}" stroke="${tAccent}" stroke-width="0.5" opacity="0.4"/>`,
  );

  if (pinned.length === 0) {
    p.push(
      `<text x="${rx + 16}" y="${questY + 46}" font-family="${mono}" font-size="13" fill="${AC.sub}">No pinned repos — start a quest.</text>`,
    );
  } else {
    pinned.forEach((repo, i) => {
      const qy = questY + 46 + i * 26;
      p.push(
        `<text x="${rx + 16}" y="${qy}" font-family="${mono}" font-size="13">`,
        `<tspan fill="${tAccent}">✓</tspan>`,
        `<tspan fill="${tFg}"> ${esc(cut(repo.name, 22))}</tspan>`,
        `<tspan fill="${AC.sub}"> — ${esc(cut(repo.description ?? "", 36))}</tspan>`,
        `<tspan fill="${AC.gold}"> ★${repo.stars ?? 0}</tspan>`,
        `</text>`,
      );
    });
  }

  // INVENTORY frame (language tags)
  const invY = questY + questH + 12;
  const invH = H - 56 - invY;
  p.push(
    `<rect x="${rx}" y="${invY}" width="${rw}" height="${invH}" fill="url(#ac-pan)" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="${rx + 16}" y="${invY + 20}" font-family="${mono}" font-size="11" fill="${tMuted}" letter-spacing="3">INVENTORY</text>`,
    `<line x1="${rx + 16}" y1="${invY + 27}" x2="${rx + rw - 16}" y2="${invY + 27}" stroke="${tAccent}" stroke-width="0.5" opacity="0.4"/>`,
  );

  // Language tags as [TAG] badges
  const allLangs = Object.keys(data.languages ?? {}).slice(0, 12);
  let tagX = rx + 16;
  let tagLine = 0;
  allLangs.forEach((lang) => {
    const tag = `[${lang.substring(0, 8).toUpperCase()}]`;
    const tagW = tag.length * 7.8 + 10;
    if (tagX + tagW > rx + rw - 20) {
      tagX = rx + 16;
      tagLine += 1;
    }
    const tagY = invY + 46 + tagLine * 22;
    p.push(
      `<text x="${tagX}" y="${tagY}" font-family="${mono}" font-size="12" fill="${tMuted}">${esc(tag)}</text>`,
    );
    tagX += tagW + 4;
  });

  // Footer bar
  const footY = H - 48;
  p.push(
    `<rect x="28" y="${footY}" width="${W - 56}" height="36" fill="${AC.panBot}" stroke="${tAccent}" stroke-width="2"/>`,
    `<text x="500" y="${footY + 22}" text-anchor="middle" font-family="${mono}" font-size="13" fill="${tAccent}" letter-spacing="2">INSERT COIN TO VIEW REPOSITORIES — ${loginLo}</text>`,
    `<text x="28" y="${footY + 22}" dx="16" font-family="${mono}" font-size="11" fill="${AC.sub}">© ${new Date().getFullYear()}</text>`,
  );

  p.push(`</svg>`);
  return p.join("\n");
}

// ─── Pixel template ───────────────────────────────────────────────────────────
function renderPixel(input: RenderInput): string {
  const { theme, fields, data, mascotSvg } = input;
  const W = 740;
  const H = 340;

  const nameRaw   = fields.name || data.name || data.login;
  const bio       = cut(fields.role || data.bio || "developer", 52);
  const tagline   = cut(fields.tagline ?? "", 60);
  const commits   = fmt(data.commits ?? data.totalContributions ?? 0);
  const stars     = fmt(data.starredRepos ?? 0);
  const langs     = topLangs(data, 4);
  const topL      = topLang(data);

  const namePix   = renderPixelText(nameRaw,   { scale: 4, fill: theme.fg });
  const bioPix    = renderPixelText(bio,        { scale: 2, fill: theme.muted });

  const p: string[] = [];

  p.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="GitHub profile card">`,
    `<defs>`,
    `<linearGradient id="px-bg" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0%" stop-color="${theme.bg}"/>`,
    `<stop offset="100%" stop-color="${adjustBrightness(theme.bg, 20)}"/>`,
    `</linearGradient>`,
    // Sprite clip windows (both sprites; used by whichever defaultMascot the user chose)
    ...spideyClipDefs("px"),
    `</defs>`,
    `<rect width="${W}" height="${H}" fill="url(#px-bg)"/>`,
    // Accent border strip on left edge
    `<rect x="0" y="0" width="4" height="${H}" fill="${theme.accent}" opacity="0.7"/>`,
  );

  // Name
  p.push(`<g transform="translate(24, 28)" shape-rendering="crispEdges">${namePix.svg}</g>`);

  // Bio
  const bioY = 28 + namePix.height + 10;
  p.push(`<g transform="translate(24, ${bioY})" shape-rendering="crispEdges">${bioPix.svg}</g>`);

  // Divider
  const divY = bioY + bioPix.height + 16;
  p.push(`<line x1="24" y1="${divY}" x2="440" y2="${divY}" stroke="${theme.muted}" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.5"/>`);

  // Stats row
  const statsY = divY + 18;
  const statLabels = [
    { k: "COMMITS", v: commits, color: theme.accent },
    { k: "STARS", v: `★ ${stars}`, color: theme.fg },
    { k: "TOP LANG", v: topL?.toUpperCase() ?? "—", color: theme.accent },
  ];
  statLabels.forEach(({ k, v, color }, i) => {
    const sx = 24 + i * 138;
    const kPix = renderPixelText(k, { scale: 1, fill: theme.muted });
    const vPix = renderPixelText(v, { scale: 2, fill: color });
    p.push(
      `<g transform="translate(${sx}, ${statsY})" shape-rendering="crispEdges">${kPix.svg}</g>`,
      `<g transform="translate(${sx}, ${statsY + kPix.height + 6})" shape-rendering="crispEdges">${vPix.svg}</g>`,
    );
  });

  // Language bars
  const barY = statsY + 60;
  p.push(
    `<line x1="24" y1="${barY - 8}" x2="440" y2="${barY - 8}" stroke="${theme.muted}" stroke-width="1" stroke-dasharray="6 5" opacity="0.4"/>`,
  );

  // Bar colors: user-set per slot, falling back to accent/fg alternating defaults
  const pxDefaultColors = [theme.accent, theme.fg, theme.accent, theme.fg];
  const pxDefaultOpacity = ["0.90", "0.75", "0.65", "0.55"];
  const pxAnimStyle = getAnimStyleNum(input.fields.barAnimation);

  langs.forEach((l, i) => {
    const by    = barY + i * 28;
    const maxBW = 200;
    const fillW = Math.max(2, Math.floor((l.pct / 100) * maxBW));
    const lPix  = renderPixelText(cut(l.name, 8).toUpperCase(), { scale: 1, fill: theme.muted });
    const color = input.fields.barColors?.[i] ?? pxDefaultColors[i % 4];
    const opacity = input.fields.barColors?.[i] ? "0.90" : pxDefaultOpacity[i % 4];
    p.push(
      `<g transform="translate(24, ${by})" shape-rendering="crispEdges">${lPix.svg}</g>`,
      `<rect x="90" y="${by - 1}" width="${maxBW}" height="9" fill="${theme.bg}" stroke="${theme.muted}" stroke-width="1" opacity="0.5" shape-rendering="crispEdges"/>`,
      `<rect x="90" y="${by - 1}" width="0" height="9" fill="${color}" opacity="${opacity}" shape-rendering="crispEdges">`,
      animateBar(fillW, i, i * 0.18, maxBW, pxAnimStyle),
      `</rect>`,
    );
  });

  // Tagline at bottom
  if (tagline) {
    const tPix = renderPixelText(tagline, { scale: 2, fill: theme.muted });
    const tY   = H - tPix.height - 16;
    p.push(
      `<line x1="24" y1="${tY - 8}" x2="${W - 24}" y2="${tY - 8}" stroke="${theme.muted}" stroke-width="1" opacity="0.25"/>`,
      `<g transform="translate(24, ${tY})" shape-rendering="crispEdges">${tPix.svg}</g>`,
    );
  }

  // Mascot — user upload takes priority; fall back to the animated Spider-Man sprite
  if (mascotSvg) {
    const fitted = normalizeMascot(mascotSvg, { x: 468, y: 16, width: 256, height: 308 });
    p.push(fitted.svg);
  } else {
    // Default mascot: user's choice, falling back to "webswing" for pixel
    const dm = (input.defaultMascot ?? "webswing") as DefaultMascotId;
    p.push(...renderMascot(dm, "px", { x: 468, y: 16, w: 256, h: 308 }, theme.fg));
  }

  // Subtle corner accent
  p.push(`<rect x="${W - 4}" y="0" width="4" height="${H}" fill="${theme.accent}" opacity="0.3"/>`);

  p.push(`</svg>`);
  return p.join("\n");
}

/** Slightly brighten a hex color by adding `delta` to each channel. */
function adjustBrightness(hex: string, delta: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return hex;
  const r = Math.max(0, Math.min(255, parseInt(h.slice(0, 2), 16) + delta));
  const g = Math.max(0, Math.min(255, parseInt(h.slice(2, 4), 16) + delta));
  const b = Math.max(0, Math.min(255, parseInt(h.slice(4, 6), 16) + delta));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// ─── Registry ─────────────────────────────────────────────────────────────────
export const TEMPLATES: Record<TemplateId, TemplateDef> = {
  pixel: {
    id: "pixel",
    label: "Pixel",
    description: "Compact pixel-art header — tight, readable, great for minimal READMEs.",
    viewBox: "0 0 740 340",
    width: 740,
    height: 340,
    mascotSlot: { x: 468, y: 16, width: 256, height: 308 },
    render: renderPixel,
  },
  fastfetch: {
    id: "fastfetch",
    label: "Fastfetch",
    description: "macOS terminal card — dark background, traffic-light titlebar, cursor blink.",
    viewBox: "0 0 1020 560",
    width: 1020,
    height: 560,
    mascotSlot: { x: 14, y: 44, width: 334, height: 498 },
    render: renderFastfetch,
  },
  arcade: {
    id: "arcade",
    label: "Arcade",
    description: "Retro CRT RPG — your mascot is the player, stats are your GitHub activity.",
    viewBox: "0 0 1000 640",
    width: 1000,
    height: 640,
    mascotSlot: { x: 62, y: 106, width: 240, height: 226 },
    render: renderArcade,
  },
};

export function renderTemplate(id: TemplateId, input: RenderInput): string {
  const tpl = TEMPLATES[id];
  if (!tpl) throw new Error(`unknown template: ${id}`);
  return tpl.render(input);
}

/** Default theme for the builder/pixel header. */
export const DEFAULT_THEME = {
  bg: "#1a1b26",
  fg: "#c0caf5",
  accent: "#7aa2f7",
  muted: "#565f89",
} as const satisfies ThemeColors;
