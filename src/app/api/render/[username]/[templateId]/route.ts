import { renderProfile } from "@/lib/render/service";
import { renderPreview } from "@/lib/render/preview";
import { createHash } from "node:crypto";
import type { ClassicTemplateId } from "@/types";

/**
 * Phase 5 — on-demand render endpoint.
 *
 * GET /api/render/{username}/{templateId}.svg
 *
 * The URL is STABLE (no version segment). Every hit re-renders from the latest
 * config, and the response carries a content-based ETag with `no-cache`, so
 * browsers/camo revalidate and get a 304 when nothing changed — the same URL
 * always reflects the newest card without the user re-copying an embed link.
 * A legacy ?v={hash} param is tolerated (it was the old cache-buster).
 */

export const dynamic = "force-dynamic";

const CLASSIC = new Set<string>(["pixel", "arcade", "fastfetch"]);
const TEMPLATES = new Set<string>(["pixel", "arcade", "fastfetch", "canvas"]);

export async function GET(
  req: Request,
  { params }: { params: Promise<{ username: string; templateId: string }> }
) {
  const { username, templateId: rawTemplateId } = await params;
  const templateId = rawTemplateId.replace(/\.svg$/i, "");
  const url = new URL(req.url);
  const isPreview = url.searchParams.get("preview") === "1";

  // Validate template early (cheap, avoids a DB hit for garbage routes). The
  // :templateId segment may arrive with a trailing ".svg" extension.
  if (!/^[a-zA-Z0-9-]+$/.test(username) || !TEMPLATES.has(templateId)) {
    return new Response("not found", { status: 404 });
  }

  let svg: string | undefined;
  let error: string | undefined;

  if (isPreview && CLASSIC.has(templateId)) {
    svg = await renderPreview(req, templateId as ClassicTemplateId);
  } else {
    const result = await renderProfile(username);
    svg = result.svg;
    error = result.error;
  }

  if (!svg) {
    const status = error === "no_config" ? 404 : 503;
    return new Response(error ?? "render error", {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const ttl = isPreview ? 0 : Number(process.env.RENDER_TTL_SECONDS ?? 0);
  // Preview: allow browser to cache for 30 s so re-typing the same value hits
  // the browser cache instead of the server. The URL is stable (no random _=N
  // counter), so identical inputs naturally reuse cached responses.
  const previewCacheControl = "public, max-age=30, stale-while-revalidate=60";
  const publishedCacheControl = `public, max-age=${ttl}, s-maxage=${ttl}, must-revalidate`;

  // Content fingerprint lets a STABLE URL revalidate: when the same SVG is
  // requested again, the client's If-None-Match matches and we return a cheap
  // 304, yet any config/mascot change produces a new ETag and a fresh body.
  const etag = `"${createHash("sha1").update(svg).digest("hex").slice(0, 16)}"`;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (!isPreview && ifNoneMatch?.split(/\s*,\s*/).includes(etag)) {
    return new Response(null, {
      status: 304,
      headers: { ETag: etag, "Cache-Control": publishedCacheControl },
    });
  }

  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": isPreview ? previewCacheControl : publishedCacheControl,
      ETag: etag,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
