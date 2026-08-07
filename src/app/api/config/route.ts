import { getServiceClient } from "@/lib/supabase/server";
import { getConfigByUser, upsertConfig } from "@/lib/data/store";
import type { TemplateId } from "@/types";
import { createHash } from "node:crypto";

/**
 * GET /api/config — fetch the authenticated user's saved card config.
 * Returns `{ ok: true, config: ProfileConfig | null }` so callers can tell
 * "no saved card yet" apart from an error.
 */
export async function GET(request: Request) {
  const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authToken) return json({ error: "unauthorized" }, 401);

  const { data, error } = await getServiceClient().auth.getUser(authToken);
  if (error || !data.user) return json({ error: "unauthorized" }, 401);
  const userId = data.user.id;

  try {
    const config = await getConfigByUser(userId);
    return json({ ok: true, config }, 200);
  } catch (err) {
    console.error("config load failed", err);
    return json({ error: "load failed" }, 500);
  }
}

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

  // Config hash drives cache revalidation (ETag) and captures every input that
  // affects the render — including the custom mascot, so re-uploading a mascot
  // properly bumps cache without needing a new URL.
  const configHash = createHash("sha256")
    .update(
      JSON.stringify({
        username: body.username,
        templateId: body.templateId,
        theme: body.theme,
        fields: body.fields,
        mascotSvgUrl: body.mascotSvgUrl ?? null,
      })
    )
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

    // The embed URL is STABLE — no changing ?v= — because the render endpoint
    // always returns the latest config and revalidates by ETag, so updating the
    // card never forces the user to re-copy a new URL into their README.
    const origin = process.env.NEXT_PUBLIC_BASE_URL ?? new URL(request.url).origin;
    const renderUrl = `${origin}/api/render/${body.username}/${body.templateId}.svg`;
    return json({ ok: true, config, renderUrl, configHash }, 200);
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