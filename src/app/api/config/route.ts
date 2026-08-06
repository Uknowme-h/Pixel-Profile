import { getServiceClient } from "@/lib/supabase/server";
import { upsertConfig } from "@/lib/data/store";
import type { TemplateId } from "@/types";
import { createHash } from "node:crypto";

/**
 * POST /api/config — save/upsert the authenticated user's card config.
 * Body: { username, templateId, theme, fields }
 */

export async function POST(request: Request) {
  const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authToken) return json({ error: "unauthorized" }, 401);

  const { data, error } = await getServiceClient().auth.getUser(authToken);
  if (error || !data.user) return json({ error: "unauthorized" }, 401);
  const userId = data.user.id;

  let body: {
    username?: string;
    templateId?: TemplateId;
    theme?: Record<string, string>;
    fields?: Record<string, unknown>;
    mascotSvgUrl?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }

  if (!body.username || !/^[a-zA-Z0-9-]+$/.test(body.username)) {
    return json({ error: "invalid username" }, 400);
  }
  if (!body.templateId || !["pixel", "arcade", "fastfetch"].includes(body.templateId)) {
    return json({ error: "invalid templateId" }, 400);
  }

  // Config hash drives URL versioning (?v=) for camo cache-busting.
  const configHash = createHash("sha256")
    .update(JSON.stringify({ username: body.username, templateId: body.templateId, theme: body.theme, fields: body.fields }))
    .digest("hex")
    .slice(0, 12);

  try {
    const config = await upsertConfig(userId, {
      username: body.username,
      templateId: body.templateId,
      theme: {
        bg: body.theme?.bg ?? "#1a1b26",
        fg: body.theme?.fg ?? "#c0caf5",
        accent: body.theme?.accent ?? "#7aa2f7",
        muted: body.theme?.muted ?? "#565f89",
      },
      fields: body.fields ?? {},
      mascotSvgUrl: body.mascotSvgUrl ?? null,
      configHash,
    });

    // Derive origin from the request so the URL is always correct in every
    // environment (local dev, Vercel preview, production) without needing an
    // explicit env var. NEXT_PUBLIC_BASE_URL can still override if needed.
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
    const renderUrl = `${origin}/api/render/${body.username}/${body.templateId}.svg?v=${configHash}`;
    return json({ ok: true, config, renderUrl }, 200);
  } catch (err) {
    console.error("config save failed", err);
    return json({ error: "save failed" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}