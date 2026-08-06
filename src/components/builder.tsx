"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { TEMPLATES } from "@/lib/svg/templates";
import type { Session } from "@supabase/supabase-js";
import type { ThemeColors, TemplateId, DefaultMascotId } from "@/types";

/**
 * Phase 7 — Builder UI.
 *
 * Template picker → live preview → form fields → mascot upload → embed code.
 * Auth: Supabase Auth GitHub OAuth (user-scoped token; all app-level fetches
 * use the GitHub App installation token server-side, never this one).
 */

const DEFAULT_THEME: ThemeColors = { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7", muted: "#565f89" };

export default function Builder() {
  const supabase = useMemo(() => getBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [configured] = useState(() => Boolean(supabase));
  const [loading, setLoading] = useState(() => !supabase);

  const [username, setUsername] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId>("pixel");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [tagline, setTagline] = useState("");
  const [theme, setTheme] = useState<ThemeColors>(DEFAULT_THEME);
  const [mascotUrl, setMascotUrl] = useState<string | null>(null);
  const [defaultMascot, setDefaultMascot] = useState<DefaultMascotId>("webswing");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  // displayUrl is the debounced preview URL actually shown in the <img>.
  // previewUrl changes immediately on every input; displayUrl trails by 300ms,
  // eliminating in-flight request spam while the user is still typing.
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      const githubUsername = data.session?.user.user_metadata?.user_name as string | undefined;
      if (githubUsername) setUsername((prev) => prev || githubUsername);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
      const githubUsername = session?.user.user_metadata?.user_name as string | undefined;
      if (githubUsername) setUsername((prev) => prev || githubUsername);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const signIn = useCallback(() => {
    if (!supabase) return;
    supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.origin } });
  }, [supabase]);

  const signOut = useCallback(() => {
    supabase?.auth.signOut();
  }, [supabase]);

  // Stable URL derived directly from inputs — no random counter so the browser
  // can cache identical URLs between renders.
  const previewUrl = useMemo(() => {
    if (!username) return null;
    const p = new URLSearchParams({
      preview: "1",
      name: name || "",
      role: role || "",
      tagline: tagline || "",
      bg: theme.bg,
      fg: theme.fg,
      accent: theme.accent,
      muted: theme.muted,
    });
    if (mascotUrl) p.set("mascot", mascotUrl);
    p.set("defaultMascot", defaultMascot);
    return `/api/render/${username}/${templateId}.svg?${p.toString()}`;
  }, [username, templateId, name, role, tagline, theme, mascotUrl, defaultMascot]);

  // Debounce: only push the new URL to the <img> after 300ms of no changes.
  // This way the server never sees more than ~3 req/s no matter how fast the
  // user types, and in-flight requests are never stacked up.
  useEffect(() => {
    if (!previewUrl) { setDisplayUrl(null); return; }
    const id = window.setTimeout(() => setDisplayUrl(previewUrl), 300);
    return () => window.clearTimeout(id);
  }, [previewUrl]);

  const canSave = Boolean(session && username.trim());

  const save = useCallback(async () => {
    if (!session || !username.trim()) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          username: username.trim(),
          templateId,
          theme,
          fields: { name: name || null, role: role || null, tagline: tagline || null, defaultMascot },
          mascotSvgUrl: mascotUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setSaveResult(data.renderUrl as string);
    } catch (err) {
      setSaveResult(null);
      window.alert(err instanceof Error ? err.message : "save failed");
    } finally {
      setSaving(false);
    }
  }, [session, username, templateId, theme, name, role, tagline, mascotUrl]);

  const uploadMascot = useCallback(
    async (file: File) => {
      if (!session || !username.trim()) {
        window.alert("Sign in and set a username first.");
        return;
      }
      const res = await fetch(`/api/upload/user/${encodeURIComponent(username.trim())}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: await file.text(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "upload failed");
      // Append a version stamp so the server-side mascot cache treats each
      // upload as a new key — without this, re-uploads serve the stale cached copy.
      setMascotUrl(`${data.url as string}?v=${Date.now()}`);
      window.alert("Mascot uploaded.");
    },
    [session, username]
  );

  const embedCode = saveResult
    ? `[![${username} profile card](${saveResult})]`
    : null;

  if (loading) return <div className="p-8 text-center">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Pixel Profile Builder</h1>
        <div>
          {session ? (
            <div className="flex items-center gap-3 text-sm">
              <span>@{session.user.user_metadata?.user_name ?? session.user.email}</span>
              <button onClick={signOut} className="rounded border px-3 py-1">Sign out</button>
            </div>
          ) : (
            <button onClick={signIn} className="rounded bg-zinc-900 px-4 py-2 text-sm text-white">
              Sign in with GitHub
            </button>
          )}
        </div>
      </header>

      {!configured ? (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          Supabase is not configured. Copy <code>.env.example</code> to{" "}
          <code>.env.local</code> and set the Supabase project keys to use the
          builder.
        </div>
      ) : !session ? (
        <p className="text-zinc-500">Sign in to build your card.</p>
      ) : (
        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-6">
            {/* Step 1: username */}
            <fieldset>
              <label className="mb-1 block text-sm font-medium">GitHub username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="nishant-jswl"
                className="w-full rounded border px-3 py-2 text-sm"
              />
            </fieldset>

            {/* Step 2: template picker */}
            <fieldset>
              <label className="mb-2 block text-sm font-medium">Template</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.values(TEMPLATES).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setTemplateId(t.id)}
                    className={`rounded border px-4 py-3 text-left text-sm ${templateId === t.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300"}`}
                  >
                    <span className="block font-medium">{t.label}</span>
                    <span className="text-xs opacity-70">{t.viewBox}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Step 3: text fields */}
            <fieldset className="space-y-3">
              <label className="block text-sm font-medium">Text</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name (defaults to GitHub name)" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Role / bio override" className="w-full rounded border px-3 py-2 text-sm" />
              <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Tagline" className="w-full rounded border px-3 py-2 text-sm" />
            </fieldset>

            {/* Step 4: theme */}
            <fieldset className="space-y-3">
              <label className="block text-sm font-medium">Theme</label>
              <div className="grid grid-cols-2 gap-3">
                {(["bg", "fg", "accent", "muted"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-2 text-sm">
                    <input
                      type="color"
                      value={theme[k]}
                      onChange={(e) => setTheme((t) => ({ ...t, [k]: e.target.value }))}
                      className="h-8 w-10 cursor-pointer"
                    />
                    {k}
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Step 5: default mascot picker */}
            <fieldset>
              <label className="mb-1 block text-sm font-medium">Default mascot</label>
              <p className="mb-3 text-xs text-zinc-500">Shown when no custom SVG is uploaded. Upload a custom SVG below to override.</p>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: "webswing", emoji: "🕷", label: "Web Swing",  desc: "Wall-crawling" },
                    { id: "headturn", emoji: "🕸", label: "Head Turn",  desc: "Idle look-around" },
                    { id: "none",     emoji: "✕",  label: "None",       desc: "Plain background" },
                  ] as { id: DefaultMascotId; emoji: string; label: string; desc: string }[]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setDefaultMascot(opt.id)}
                    className={`rounded border px-3 py-2.5 text-center text-sm transition-colors ${
                      defaultMascot === opt.id
                        ? "border-zinc-900 bg-zinc-900 text-white"
                        : "border-zinc-300 hover:border-zinc-500"
                    }`}
                  >
                    <span className="block text-base">{opt.emoji}</span>
                    <span className="block font-medium leading-tight">{opt.label}</span>
                    <span className="block text-xs opacity-60">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Step 6: custom mascot upload (overrides the default above) */}
            <fieldset>
              <label className="mb-2 block text-sm font-medium">Custom mascot SVG <span className="font-normal text-zinc-400">(optional — overrides default)</span></label>
              <input
                type="file"
                accept="image/svg+xml,.svg"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMascot(f).catch((err) => window.alert(err.message));
                }}
                className="text-sm"
              />
              {mascotUrl && <p className="mt-1 text-xs text-emerald-600">Uploaded ✓</p>}
            </fieldset>

            {/* Save */}
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="rounded bg-emerald-600 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save card"}
            </button>
            {saveResult && (
              <div className="rounded bg-zinc-100 p-3 text-sm">
                <p className="mb-1 font-medium">Embed in your README:</p>
                <pre className="whitespace-pre-wrap break-all text-xs">{embedCode}</pre>
                <p className="mt-2 text-xs text-zinc-500">
                  Your card refreshes in the background every ~30 min. Versioned
                  URL (?v=hash) busts GitHub&apos;s camo cache when you change config.
                </p>
              </div>
            )}
          </section>

          {/* Live preview */}
          <aside className="lg:sticky lg:top-8">
            <h2 className="mb-3 text-sm font-medium">Preview</h2>
            <div className="overflow-hidden rounded border bg-zinc-50 p-4">
              {displayUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayUrl} alt="Card preview" className="mx-auto h-auto w-full" />
              ) : (
                <p className="text-sm text-zinc-400">Enter a username to preview.</p>
              )}
            </div>
            {displayUrl && (
              <p className="mt-2 text-xs text-zinc-500">
                Live preview renders via the template engine — no font needed, all pixel rects.
              </p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}