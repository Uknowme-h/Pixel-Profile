import { getServiceClient } from "@/lib/supabase/server";
import { getConfigByUser, upsertConfig } from "@/lib/data/store";
import { parseScene } from "@/lib/editor/schema";
import { SceneError } from "@/lib/editor/types";
import { createHash } from "node:crypto";

export const dynamic = "force-dynamic";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function userIdFrom(request: Request): Promise<string | null> {
  const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authToken) return null;
  const { data, error } = await getServiceClient().auth.getUser(authToken);
  if (error || !data.user) return null;
  return data.user.id;
}

/** GET /api/editor/scene — load the signed-in user's canvas scene. */
export async function GET(request: Request) {
  const userId = await userIdFrom(request);
  if (!userId) return json({ error: "unauthorized" }, 401);
  try {
    const config = await getConfigByUser(userId);
    if (!config || config.templateId !== "canvas") {
      return json({ ok: true, scene: null, username: config?.username ?? null }, 200);
    }
    return json({ ok: true, scene: config.fields.scene ?? null, username: config.username }, 200);
  } catch {
    return json({ error: "load failed" }, 500);
  }
}

/**
 * PUT /api/editor/scene — persist canvas scene onto the user's config.
 * Body: { username, scene }
 */
export async function PUT(request: Request) {
  const userId = await userIdFrom(request);
  if (!userId) return json({ error: "unauthorized" }, 401);

  let body: { username?: string; scene?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  if (!body.username || !/^[a-zA-Z0-9-]+$/.test(body.username)) {
    return json({ error: "invalid username" }, 400);
  }

  let scene;
  try {
    scene = parseScene(body.scene);
  } catch (err) {
    return json({ error: err instanceof SceneError ? err.message : "invalid scene" }, 400);
  }

  const existing = await getConfigByUser(userId).catch(() => null);
  const theme = existing?.theme ?? { bg: "#111111", fg: "#f5f5f0", accent: "#c8f54a", muted: "#9a9a90" };
  const fields = { ...(existing?.fields ?? {}), scene };
  const configHash = createHash("sha256")
    .update(JSON.stringify({ username: body.username, templateId: "canvas", scene }))
    .digest("hex")
    .slice(0, 12);

  try {
    const config = await upsertConfig(userId, {
      username: body.username,
      templateId: "canvas",
      theme,
      fields,
      mascotSvgUrl: existing?.mascotSvgUrl ?? existing?.fields.mascotSvgUrl ?? null,
      configHash,
    });
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
    const renderUrl = `${origin}/api/render/${body.username}/canvas.svg`;
    return json({ ok: true, config, renderUrl, configHash }, 200);
  } catch (err) {
    console.error("editor scene save failed", err);
    return json({ error: "save failed" }, 500);
  }
}
