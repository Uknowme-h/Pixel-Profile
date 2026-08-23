import { gifToSprite, GifError, GIF_MAX_BYTES, GIF_MAX_OUT_W, GIF_MAX_OUT_H } from "@/lib/svg/gif";

export const dynamic = "force-dynamic";

/**
 * POST /api/editor/gif
 * Query: optional w,h — fit the SMIL sprite into that cell (default 128×128).
 * Raw GIF body → PNG sprite strip + timing for GitHub-safe SVG.
 */
export async function POST(request: Request) {
  const buf = Buffer.from(await request.arrayBuffer());
  if (buf.byteLength === 0) return json({ error: "empty upload" }, 400);
  if (buf.byteLength > GIF_MAX_BYTES) {
    return json({ error: `gif exceeds ${GIF_MAX_BYTES / 1e6}MB` }, 413);
  }
  const url = new URL(request.url);
  const w = Number(url.searchParams.get("w"));
  const h = Number(url.searchParams.get("h"));
  const target =
    Number.isFinite(w) && Number.isFinite(h) && w >= 16 && h >= 16
      ? { width: Math.min(GIF_MAX_OUT_W, Math.round(w)), height: Math.min(GIF_MAX_OUT_H, Math.round(h)) }
      : undefined;
  try {
    const sprite = gifToSprite(buf, target);
    return json({ ok: true, ...sprite }, 200);
  } catch (err) {
    const msg = err instanceof GifError ? err.message : "gif convert failed";
    return json({ error: msg }, 400);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
