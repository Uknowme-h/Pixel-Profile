import { createClient } from "@supabase/supabase-js";
import { getServiceClient } from "@/lib/supabase/server";
import { sanitizeSvg, namespaceDefs, SanitizeError, MAX_UPLOAD_BYTES } from "@/lib/svg/sanitize";
import { createHash } from "node:crypto";

/**
 * Phase 6 — upload & sanitization pipeline.
 *
 * POST /api/upload/user/{username}
 *
 * Flow: read raw body (SVG) → enforce size cap → sanitize (strip scripts,
 * handlers, foreignObject, external refs, style) → namespace defs/ids to avoid
 * collision with template ids → store in supabase Storage bucket "mascots" →
 * save the public URL to the caller's profile_configs.fields.mascotSvgUrl.
 *
 * Malformed/malicious uploads are REJECTED (4xx), never silently stripped.
 */

const MASCOT_BUCKET = "mascots";

/**
 * Authenticate a request as a specific Supabase Auth user via the bearer token,
 * using the service (admin) client so RLS on auth does not block us.
 */
async function authenticateUser(token: string): Promise<string | null> {
  const { data, error } = await getServiceClient().auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Ensure the storage bucket + a public policy exist (idempotent).
async function ensureBucket(): Promise<void> {
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  await admin.storage.createBucket(MASCOT_BUCKET, { public: true }).catch((e) => {
    if (String(e?.message ?? "").toLowerCase().includes("already exists")) return;
    throw e;
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;

  if (!/^[a-zA-Z0-9-]+$/.test(username)) {
    return json({ error: "invalid username" }, 400);
  }

  // Auth: the user must be signed in and editing their own config.
  const authToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!authToken) return json({ error: "unauthorized" }, 401);
  const userId = await authenticateUser(authToken);
  if (!userId) return json({ error: "unauthorized" }, 401);

  // Body size gate BEFORE any parsing (block entity bombs early).
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_UPLOAD_BYTES) {
    return json({ error: `upload exceeds ${MAX_UPLOAD_BYTES / 1e6}MB cap` }, 413);
  }

  try {
    const sanitized = sanitizeSvg(raw);

    // Namespace user defs/ids so they can't collide with template ids when
    // composed into the card.
    const scopeId = createHash("sha1").update(username).digest("hex").slice(0, 8);
    const namespaced = namespaceDefs(sanitized, `${userId.slice(0, 8)}-${scopeId}`);

    await ensureBucket();
    const objectPath = `user/${userId}/${username}.svg`;
    const upload = await getServiceClient().storage
      .from(MASCOT_BUCKET)
      .upload(objectPath, namespaced, { contentType: "image/svg+xml", upsert: true });
    if (upload.error) throw upload.error;

    const publicUrl = getServiceClient().storage.from(MASCOT_BUCKET).getPublicUrl(objectPath).data.publicUrl;

    // Persist the URL on the user's config so the render actually uses it.
    const { data: cfg } = await getServiceClient()
      .from("profile_configs")
      .select("fields")
      .eq("user_id", userId)
      .maybeSingle();
    const fields = (cfg?.fields as Record<string, unknown> | null) ?? {};
    fields.mascotSvgUrl = publicUrl;

    const { error: cfgErr } = await getServiceClient()
      .from("profile_configs")
      .update({ fields, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (cfgErr) throw cfgErr;

    return json({ ok: true, path: objectPath, url: publicUrl }, 200);
  } catch (err) {
    if (err instanceof SanitizeError) {
      return json({ error: err.message }, 422);
    }
    console.error("upload failed", err);
    return json({ error: "upload failed" }, 500);
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}