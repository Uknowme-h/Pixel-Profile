import { animatedInner } from "@/lib/editor/animations";
import { DEMO_COMPILE_DATA } from "@/lib/editor/demo";
import { parseScene } from "@/lib/editor/schema";
import { resolveNodeProps } from "@/lib/editor/tokens";
import type { CompileData, EditorScene, SceneNode } from "@/lib/editor/types";
import { spriteXValues } from "@/lib/svg/gif";

const FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hex(v: unknown, fallback: string): string {
  return typeof v === "string" && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function paint(v: unknown, fallback: string): string {
  if (v === "none" || v === "transparent") return "none";
  return hex(v, fallback);
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function wrapNode(node: SceneNode, inner: string): string {
  const rot = node.rotation ? ` rotate(${node.rotation} ${node.w / 2} ${node.h / 2})` : "";
  return (
    `<g transform="translate(${node.x}, ${node.y})${rot}">` +
    `<g id="${xml(node.id)}">${animatedInner(node, inner)}</g>` +
    `</g>`
  );
}

function renderText(node: SceneNode): string {
  const fill = hex(node.props.fill, "#f5f5f0");
  const size = num(node.props.fontSize, 22);
  const weight = str(node.props.weight, "normal") === "bold" ? "bold" : "normal";
  const lines = str(node.props.content, "").split(/\r?\n/);
  const tspans = lines
    .map((line, i) => {
      const dy = i === 0 ? size : Math.round(size * 1.25);
      return `<tspan x="0" dy="${dy}">${xml(line.length ? line : " ")}</tspan>`;
    })
    .join("");
  return `<text fill="${fill}" font-size="${size}" font-family="${FONT}" font-weight="${weight}">${tspans}</text>`;
}

function renderStatPill(node: SceneNode): string {
  const fill = paint(node.props.fill, "#1c1c1a");
  const accent = hex(node.props.accent, "#c8f54a");
  const text = hex(node.props.text, "#f5f5f0");
  const label = xml(str(node.props.label, "stat"));
  const value = xml(str(node.props.value, "0"));
  const rx = Math.min(12, node.h / 4);
  return [
    `<rect x="0" y="0" width="${node.w}" height="${node.h}" rx="${rx}" fill="${fill}" stroke="${accent}" stroke-width="1"/>`,
    `<text x="12" y="22" fill="${accent}" font-size="10" font-family="${FONT}" font-weight="bold">${label}</text>`,
    `<text x="12" y="${node.h - 12}" fill="${text}" font-size="18" font-family="${FONT}" font-weight="bold">${value}</text>`,
  ].join("");
}

function renderStatRow(node: SceneNode, data: CompileData): string {
  const fill = paint(node.props.fill, "#1c1c1a");
  const accent = hex(node.props.accent, "#c8f54a");
  const text = hex(node.props.text, "#f5f5f0");
  const items = [
    ["commits", String(data.commits)],
    ["prs", String(data.pullRequests)],
    ["issues", String(data.issues)],
  ];
  const gap = 8;
  const pillW = Math.max(72, (node.w - gap * (items.length - 1)) / items.length);
  const rx = 10;
  return items
    .map(([label, value], i) => {
      const x = i * (pillW + gap);
      return [
        `<rect x="${x}" y="0" width="${pillW}" height="${node.h}" rx="${rx}" fill="${fill}" stroke="${accent}" stroke-width="1"/>`,
        `<text x="${x + 10}" y="22" fill="${accent}" font-size="10" font-family="${FONT}" font-weight="bold">${label}</text>`,
        `<text x="${x + 10}" y="${node.h - 14}" fill="${text}" font-size="16" font-family="${FONT}" font-weight="bold">${xml(value)}</text>`,
      ].join("");
    })
    .join("");
}

function fitMonoLabel(name: string, maxPx: number, fontSize: number): string {
  const cw = Math.max(4, fontSize * 0.62);
  const maxChars = Math.max(1, Math.floor(maxPx / cw));
  if (name.length <= maxChars) return name;
  if (maxChars <= 1) return "…";
  return `${name.slice(0, maxChars - 1)}…`;
}

function renderLanguageBar(node: SceneNode, data: CompileData): string {
  const fill = paint(node.props.fill, "#f5f5f0");
  const bar = hex(node.props.bar, "#c8f54a");
  const text = hex(node.props.text, hex(node.props.muted, "#9a9a90"));
  const langs = Object.entries(data.languages)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  const total = langs.reduce((s, [, n]) => s + n, 0) || 1;
  const rowH = langs.length ? node.h / langs.length : node.h;
  const fontSize = 10;
  const gutter = 8;
  const minBar = 64;
  const maxLabel = Math.max(40, node.w - minBar - gutter);
  const longest = langs.reduce((m, [n]) => Math.max(m, n.length), 0);
  const labelW = Math.min(maxLabel, Math.max(48, longest * fontSize * 0.62));
  const barX = labelW + gutter;
  const trackW = Math.max(4, node.w - barX);
  return langs
    .map(([name, bytes], i) => {
      const y = i * rowH;
      const pct = bytes / total;
      const barW = Math.max(4, trackW * pct);
      const clip = `${xml(node.id)}-lbl${i}`;
      const label = xml(fitMonoLabel(name, labelW, fontSize));
      const baseline = y + Math.min(rowH - 2, Math.max(10, rowH * 0.55));
      return [
        `<defs><clipPath id="${clip}"><rect x="0" y="${y.toFixed(1)}" width="${labelW.toFixed(1)}" height="${rowH.toFixed(1)}"/></clipPath></defs>`,
        `<text x="0" y="${baseline.toFixed(1)}" fill="${text}" font-size="${fontSize}" font-family="${FONT}" clip-path="url(#${clip})">${label}</text>`,
        `<rect x="${barX.toFixed(1)}" y="${y + Math.max(2, (rowH - 8) / 2)}" width="${trackW.toFixed(1)}" height="8" fill="${fill}" opacity="0.15"/>`,
        `<rect x="${barX.toFixed(1)}" y="${y + Math.max(2, (rowH - 8) / 2)}" width="${barW.toFixed(1)}" height="8" fill="${bar}"/>`,
      ].join("");
    })
    .join("");
}

function renderSocial(node: SceneNode): string {
  const fill = paint(node.props.fill, "#c8f54a");
  const text = hex(node.props.text, "#111111");
  const label = xml(str(node.props.label, "GitHub"));
  const rx = Math.min(8, node.h / 2);
  return [
    `<rect x="0" y="0" width="${node.w}" height="${node.h}" rx="${rx}" fill="${fill}"/>`,
    `<text x="${node.w / 2}" y="${node.h / 2 + 5}" text-anchor="middle" fill="${text}" font-size="13" font-family="${FONT}" font-weight="bold">${label}</text>`,
  ].join("");
}

function paintOpacity(node: SceneNode): string {
  const o = num(node.props.opacity, 1);
  if (o >= 0.999) return "";
  return ` opacity="${Math.min(1, Math.max(0, o)).toFixed(2)}"`;
}

function renderRect(node: SceneNode): string {
  const fill = paint(node.props.fill, "#c8f54a");
  const rx = num(node.props.radius, 0);
  return `<rect x="0" y="0" width="${node.w}" height="${node.h}" rx="${rx}" fill="${fill}"${paintOpacity(node)}/>`;
}

function renderEllipse(node: SceneNode): string {
  const fill = paint(node.props.fill, "#f5f5f0");
  return `<ellipse cx="${node.w / 2}" cy="${node.h / 2}" rx="${node.w / 2}" ry="${node.h / 2}" fill="${fill}"${paintOpacity(node)}/>`;
}

function renderLine(node: SceneNode): string {
  const stroke = hex(node.props.stroke, "#c8f54a");
  const sw = num(node.props.strokeWidth, 2);
  const y = node.h / 2;
  return `<line x1="0" y1="${y}" x2="${node.w}" y2="${y}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="square"/>`;
}

function renderSprite(node: SceneNode): string {
  const sheet = str(node.props.sheet, "");
  if (!sheet.startsWith("data:image/png;base64,")) return "";
  const fw = Math.max(1, Math.floor(num(node.props.fw, node.w)));
  const fh = Math.max(1, Math.floor(num(node.props.fh, node.h)));
  const frames = Math.max(1, Math.min(48, Math.floor(num(node.props.frames, 1))));
  const dur = str(node.props.dur, "1s");
  if (!/^\d+(\.\d+)?s$/.test(dur)) return "";
  const clip = `${xml(node.id)}-clip`;
  const sx = node.w / fw;
  const sy = node.h / fh;
  const anim =
    frames > 1
      ? `<animate attributeName="x" values="${spriteXValues(frames, fw)}" dur="${dur}" repeatCount="indefinite" calcMode="discrete"/>`
      : "";
  return [
    `<defs><clipPath id="${clip}"><rect x="0" y="0" width="${fw}" height="${fh}"/></clipPath></defs>`,
    `<g clip-path="url(#${clip})" transform="scale(${sx.toFixed(4)} ${sy.toFixed(4)})">`,
    `<image href="${sheet}" width="${fw * frames}" height="${fh}" x="0" y="0">${anim}</image>`,
    `</g>`,
  ].join("");
}

function renderInner(node: SceneNode, data: CompileData): string {
  switch (node.type) {
    case "text":
      return renderText(node);
    case "statPill":
      return renderStatPill(node);
    case "statRow":
      return renderStatRow(node, data);
    case "languageBar":
      return renderLanguageBar(node, data);
    case "socialButton":
      return renderSocial(node);
    case "shape.rect":
      return renderRect(node);
    case "shape.ellipse":
      return renderEllipse(node);
    case "shape.line":
      return renderLine(node);
    case "sprite":
      return renderSprite(node);
    default:
      return "";
  }
}

export function compileScene(raw: unknown, data: CompileData = DEMO_COMPILE_DATA): string {
  const scene: EditorScene = parseScene(raw);
  const r = scene.background.radius ?? 0;
  const nodes = [...scene.nodes].filter((n) => n.visible !== false).sort((a, b) => a.z - b.z);
  const bg = paint(scene.background.fill, "#111111");
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="0 0 ${scene.width} ${scene.height}" role="img">`,
  ];
  if (bg !== "none") {
    parts.push(`<rect x="0" y="0" width="${scene.width}" height="${scene.height}" rx="${r}" fill="${bg}"/>`);
  }
  for (const node of nodes) {
    const resolved = { ...node, props: resolveNodeProps(node.props, data) };
    const inner = renderInner(resolved, data);
    if (!inner) continue;
    parts.push(wrapNode(resolved, inner));
  }
  parts.push("</svg>");
  // Generated from a validated scene graph with XML-escaped text. Do not run
  // sanitizeSvg here — linkedom lowercases SMIL attrs (attributeName → attributename)
  // which breaks GitHub README animation.
  return parts.join("");
}

export { DEMO_COMPILE_DATA };
