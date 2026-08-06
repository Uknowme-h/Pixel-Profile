import { renderProfile } from "@/lib/render/service";
import { renderPreview } from "@/lib/render/preview";

/**
 * Phase 5 — on-demand render endpoint.
 *
 * GET /api/render/{username}/{templateId}.svg?v={config_hash}
 *
 * Cache-bust by versioning the URL, not the header: camo caches by URL and the
 * README HTML is cached too, so the explicit ?v= is the only reliable way to
 * defeat stale badges. Keep this route dependency-light for cold-start health.
 */

export const dynamic = "force-dynamic";

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
  if (!/^[a-zA-Z0-9-]+$/.test(username) || !["pixel", "arcade", "fastfetch"].includes(templateId)) {
    return new Response("not found", { status: 404 });
  }

  let svg: string | undefined;
  let error: string | undefined;

  if (isPreview) {
    svg = await renderPreview(req, templateId as "pixel" | "arcade" | "fastfetch");
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

  const ttl = isPreview ? 0 : Number(process.env.RENDER_TTL_SECONDS ?? 3600);
  // Preview: allow browser to cache for 30 s so re-typing the same value hits
  // the browser cache instead of the server. The URL is stable (no random _=N
  // counter), so identical inputs naturally reuse cached responses.
  const previewCacheControl = "public, max-age=30, stale-while-revalidate=60";
  return new Response(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": isPreview ? previewCacheControl : `public, s-maxage=${ttl}, max-age=${ttl}, stale-while-revalidate=86400`,
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
