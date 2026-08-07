"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { TEMPLATES } from "@/lib/svg/templates";
import type { Session } from "@supabase/supabase-js";
import type { ThemeColors, TemplateId, DefaultMascotId, BarStyle } from "@/types";

/**
 * Phase 7 — Builder UI.
 *
 * Template picker → live preview → form fields → mascot upload → embed code.
 * Auth: Supabase Auth GitHub OAuth (user-scoped token; all app-level fetches
 * use the GitHub App installation token server-side, never this one).
 */

const DEFAULT_THEME: ThemeColors = { bg: "#1a1b26", fg: "#c0caf5", accent: "#7aa2f7", muted: "#565f89" };
const DEFAULT_BAR_COLORS = [DEFAULT_THEME.accent, DEFAULT_THEME.fg, DEFAULT_THEME.accent, DEFAULT_THEME.fg];

const GITHUB_MARK_PATH =
  "M56.7937 84.9688C44.4187 83.4688 35.7 74.5625 35.7 63.0313C35.7 58.3438 37.3875 53.2813 40.2 49.9063C38.9812 46.8125 39.1687 40.25 40.575 37.5313C44.325 37.0625 49.3875 39.0313 52.3875 41.75C55.95 40.625 59.7 40.0625 64.2937 40.0625C68.8875 40.0625 72.6375 40.625 76.0125 41.6563C78.9187 39.0313 84.075 37.0625 87.825 37.5313C89.1375 40.0625 89.325 46.625 88.1062 49.8125C91.1062 53.375 92.7 58.1563 92.7 63.0313C92.7 74.5625 83.9812 83.2813 71.4187 84.875C74.6062 86.9375 76.7625 91.4375 76.7625 96.5938L76.7625 106.344C76.7625 109.156 79.1062 110.75 81.9187 109.625C98.8875 103.156 112.2 86.1875 112.2 65.1875C112.2 38.6563 90.6375 17 64.1062 17C37.575 17 16.2 38.6562 16.2 65.1875C16.2 86 29.4187 103.25 47.2312 109.719C49.7625 110.656 52.2 108.969 52.2 106.438L52.2 98.9375C50.8875 99.5 49.2 99.875 47.7 99.875C41.5125 99.875 37.8562 96.5 35.2312 90.2188C34.2 87.6875 33.075 86.1875 30.9187 85.9063C29.7937 85.8125 29.4187 85.3438 29.4187 84.7813C29.4187 83.6563 31.2937 82.8125 33.1687 82.8125C35.8875 82.8125 38.2312 84.5 40.6687 87.9688C42.5437 90.6875 44.5125 91.9063 46.8562 91.9063C49.2 91.9063 50.7 91.0625 52.8562 88.9063C54.45 87.3125 55.6687 85.9063 56.7937 84.9688Z";

function GitHubMarkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 128 128" aria-hidden="true" className={className}>
      <path d={GITHUB_MARK_PATH} />
    </svg>
  );
}

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
  const [mascotFileName, setMascotFileName] = useState<string | null>(null);
  const [uploadingMascot, setUploadingMascot] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const [barColors, setBarColors] = useState<string[]>(DEFAULT_BAR_COLORS);
  const [barAnimation, setBarAnimation] = useState<BarStyle>("ease-out");
  // displayUrl is the debounced preview URL actually shown in the <img>.
  // previewUrl changes immediately on every input; displayUrl trails by 300ms,
  // eliminating in-flight request spam while the user is still typing.
  const [displayUrl, setDisplayUrl] = useState<string | null>(null);
  // "load saved card" flow state.
  const [loadState, setLoadState] = useState<"idle" | "loading" | "loaded" | "none" | "error">("idle");

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

  useEffect(() => {
    fetch("https://api.github.com/repos/Uknowme-h/Pixel-Profile", {
      headers: { Accept: "application/vnd.github+json" },
    })
      .then((r) => r.json())
      .then((d) => { if (typeof d.stargazers_count === "number") setStars(d.stargazers_count); })
      .catch(() => {});
  }, []);

  const signIn = useCallback(() => {
    if (!supabase) return;
    supabase.auth.signInWithOAuth({ provider: "github", options: { redirectTo: window.location.origin } });
  }, [supabase]);

  const signOut = useCallback(() => {
    supabase?.auth.signOut();
  }, [supabase]);

  // Picking a built-in mascot also clears any uploaded custom one, otherwise
  // the custom mascot would keep overriding the selection in the preview.
  const chooseMascot = useCallback((id: DefaultMascotId) => {
    setDefaultMascot(id);
    if (mascotUrl) {
      setMascotUrl(null);
      setMascotFileName(null);
    }
  }, [mascotUrl]);

  // Drop the uploaded mascot and let the current default mascot show again.
  const clearMascot = useCallback(() => {
    setMascotUrl(null);
    setMascotFileName(null);
  }, []);

  // Restore a previously saved card config into the form so the user can keep
  // working on it. The persisted card lives in the top-level `mascot_svg_url`
  // column (that's what save writes), while `fields.mascotSvgUrl` is unused —
  // so we read from the column first, falling back to the field for safety.
  const loadSaved = useCallback(async () => {
    if (!session) return;
    setLoadState("loading");
    try {
      const res = await fetch("/api/config", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "load failed");
      if (!data.config) { setLoadState("none"); return; }
      const c = data.config;
      setUsername(c.username || "");
      setTemplateId(c.templateId);
      setTheme(c.theme);
      setName(c.fields?.name ?? "");
      setRole(c.fields?.role ?? "");
      setTagline(c.fields?.tagline ?? "");
      setDefaultMascot(c.fields?.defaultMascot ?? "webswing");
      setBarColors(c.fields?.barColors ?? DEFAULT_BAR_COLORS);
      setBarAnimation(c.fields?.barAnimation ?? "ease-out");
      setMascotUrl(c.fields?.mascotSvgUrl ?? c.mascotSvgUrl ?? null);
      setMascotFileName(null);
      setSaveResult(null);
      setLoadState("loaded");
    } catch {
      setLoadState("error");
    }
  }, [session]);

  // Auto-restore the user's last saved card once when they land after signing
  // in, so the preview is already populated and ready to keep editing.
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (!session || autoLoadedRef.current || loadState !== "idle") return;
    autoLoadedRef.current = true;
    loadSaved();
  }, [session, loadState, loadSaved]);

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
    barColors.forEach((c, i) => p.set(`barColor${i}`, c));
    p.set("barAnim", barAnimation);
    return `/api/render/${username}/${templateId}.svg?${p.toString()}`;
  }, [username, templateId, name, role, tagline, theme, mascotUrl, defaultMascot, barColors, barAnimation]);

  // Debounce: only push the new URL to the <img> after 300ms of no changes.
  // This way the server never sees more than ~3 req/s no matter how fast the
  // user types, and in-flight requests are never stacked up.
  useEffect(() => {
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
          fields: { name: name || null, role: role || null, tagline: tagline || null, defaultMascot, barColors, barAnimation },
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
  }, [session, username, templateId, theme, name, role, tagline, mascotUrl, defaultMascot, barColors, barAnimation]);

  const uploadMascot = useCallback(
    async (file: File) => {
      if (!session || !username.trim()) {
        window.alert("Sign in and set a username first.");
        return;
      }
      setUploadingMascot(true);
      setMascotFileName(file.name);
      try {
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
      } finally {
        setUploadingMascot(false);
      }
    },
    [session, username]
  );

  const embedCode = saveResult
    ? `[![${username} profile card](${saveResult})]`
    : null;

  if (loading) return (
    <div className="flex h-full items-center justify-center bg-[#F8F8F8]">
      <span className="text-sm text-[#777]">loading…</span>
    </div>
  );

  if (!session) return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#F8F8F8] text-[#111]">
      {!configured && (
        <div className="border-b border-[#DCDCDC] bg-white px-8 py-3 text-xs text-[#777]">
          Supabase not configured — copy <code className="font-mono">.env.example</code> to{" "}
          <code className="font-mono">.env.local</code> and set your project keys.
        </div>
      )}

      <header className="flex items-center justify-between border-b border-[#DCDCDC] px-8 py-4">
        <span className="font-mono text-sm font-medium tracking-tight">pixel profile</span>
        <div className="flex items-center gap-5">
          {stars !== null && (
            <a
              href="https://github.com/Uknowme-h/Pixel-Profile"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-[#777] transition-opacity hover:opacity-60"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-[#777]" aria-hidden="true">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
              </svg>
              <span className="font-mono">{stars.toLocaleString()}</span>
            </a>
          )}
          <button
            onClick={signIn}
            className="flex items-center gap-2 text-sm transition-opacity hover:opacity-50"
          >
            sign in
            <GitHubMarkIcon className="h-4 w-4 fill-[#111]" />
          </button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <h1 className="mb-4 font-mono text-4xl font-normal leading-[1.2] tracking-tight sm:text-5xl">
          Animated profile cards<br />for your GitHub README.
        </h1>
        <p className="mb-12 max-w-sm text-[#777]">
          Pick a template, set your colors, and embed a live card that refreshes with your GitHub stats.
        </p>

        <div className="mb-12 w-full max-w-md border border-[#DCDCDC] bg-white p-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/api/render/octocat/pixel.svg?preview=1&name=octocat&role=GitHub+mascot&tagline=Hello+World&bg=%231a1b26&fg=%23c0caf5&accent=%237aa2f7&muted=%23565f89&defaultMascot=webswing"
            alt="Example animated profile card"
            className="mx-auto w-full"
            loading="eager"
            onError={(e) => {
              const el = e.currentTarget.parentElement;
              if (el) el.style.display = "none";
            }}
          />
        </div>

        <button
          onClick={signIn}
          className="flex items-center gap-2.5 bg-[#111] px-6 py-3 text-sm font-medium text-white transition-opacity hover:opacity-75"
        >
          <GitHubMarkIcon className="h-4 w-4 fill-white" />
          Sign in with GitHub
        </button>

        <p className="mt-10 font-mono text-xs tracking-wider text-[#777]">
          pixel · arcade · fastfetch
        </p>
      </main>

      <footer className="border-t border-[#DCDCDC] px-8 py-4">
        <p className="text-xs text-[#777]">Free and open source. No data stored beyond your card config.</p>
      </footer>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8F8F8] text-[#111]">
    <header className="flex shrink-0 items-center justify-between border-b border-[#DCDCDC] px-8 py-4">
      <span className="font-mono text-sm font-medium tracking-tight">pixel profile</span>
      <div className="flex items-center gap-5">
        {stars !== null && (
          <a
            href="https://github.com/Uknowme-h/Pixel-Profile"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#555] transition-opacity hover:opacity-60"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-[#555]" aria-hidden="true">
              <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
            </svg>
            <span className="font-mono">{stars.toLocaleString()}</span>
          </a>
        )}
        <span className="font-mono text-xs text-[#555]">@{session.user.user_metadata?.user_name ?? session.user.email}</span>
        <button
          onClick={signOut}
          className="text-sm text-[#111] transition-opacity hover:opacity-50"
        >
          sign out
        </button>
      </div>
    </header>
    <div className="flex min-h-0 flex-1 overflow-hidden">

      {/* ── Form ───────────────────────────────────────────────── */}
      <aside className="w-[400px] shrink-0 overflow-y-auto border-r border-[#E4E4E4]">
        <div className="space-y-10 px-8 py-10">

          {!configured && (
            <div className="border-l-2 border-amber-400 bg-amber-50 px-4 py-3 text-xs text-amber-700">
              Supabase not configured — copy <code>.env.example</code> to{" "}
              <code>.env.local</code>.
            </div>
          )}

          {/* 01 — Template */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-[10px] text-[#888]">01</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#555]">Template</span>
              <div className="h-px flex-1 bg-[#E0E0E0]" />
            </div>
            <div className="flex gap-1.5">
              {Object.values(TEMPLATES).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTemplateId(t.id)}
                  className={`flex-1 border px-3 py-2.5 text-left transition-colors ${
                    templateId === t.id
                      ? "border-[#111] bg-[#111] text-white"
                      : "border-[#E0E0E0] text-[#555] hover:border-[#999] hover:text-[#111]"
                  }`}
                >
                  <span className="block text-[10px] uppercase tracking-[0.15em]">{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 02 — Identity */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-[10px] text-[#888]">02</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#555]">Identity</span>
              <div className="h-px flex-1 bg-[#E0E0E0]" />
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="github username"
              className="w-full border-b border-[#E0E0E0] bg-transparent py-2.5 text-sm placeholder:text-[#999] focus:border-[#111] focus:outline-none"
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="display name"
              className="w-full border-b border-[#E0E0E0] bg-transparent py-2.5 text-sm placeholder:text-[#999] focus:border-[#111] focus:outline-none"
            />
            <input
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="role / bio"
              className="w-full border-b border-[#E0E0E0] bg-transparent py-2.5 text-sm placeholder:text-[#999] focus:border-[#111] focus:outline-none"
            />
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="tagline"
              className="w-full border-b border-[#E0E0E0] bg-transparent py-2.5 text-sm placeholder:text-[#999] focus:border-[#111] focus:outline-none"
            />
          </div>

          {/* 03 — Theme */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-[10px] text-[#888]">03</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#555]">Theme</span>
              <div className="h-px flex-1 bg-[#E0E0E0]" />
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {(["bg", "fg", "accent", "muted"] as const).map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-3">
                  <input
                    type="color"
                    value={theme[k]}
                    onChange={(e) => setTheme((t) => ({ ...t, [k]: e.target.value }))}
                    className="h-7 w-7 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#555]">{k}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 04 — Bars */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-[10px] text-[#888]">04</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#555]">Bars</span>
              <div className="h-px flex-1 bg-[#E0E0E0]" />
            </div>
            <p className="mb-3 text-[10px] uppercase tracking-[0.15em] text-[#666]">Colors</p>
            <div className="mb-6 flex items-end gap-5">
              {barColors.map((c, i) => (
                <label key={i} className="flex cursor-pointer flex-col items-center gap-1.5">
                  <input
                    type="color"
                    value={c}
                    onChange={(e) => setBarColors((prev) => prev.map((v, j) => j === i ? e.target.value : v))}
                    className="h-8 w-8 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <span className="text-[10px] text-[#777]">{i + 1}</span>
                </label>
              ))}
            </div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-[#666]">Animation</p>
            <div className="flex border border-[#E0E0E0]">
              {(
                [
                  { id: "ease-out", label: "Ease" },
                  { id: "bounce",   label: "Bounce" },
                  { id: "linear",   label: "Linear" },
                  { id: "step",     label: "Step" },
                ] as { id: BarStyle; label: string }[]
              ).map((opt, i) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBarAnimation(opt.id)}
                  className={`flex-1 py-2 text-[10px] uppercase tracking-[0.12em] transition-colors ${
                    i > 0 ? "border-l border-[#E0E0E0]" : ""
                  } ${
                    barAnimation === opt.id
                      ? "bg-[#111] text-white"
                      : "text-[#555] hover:bg-[#F0F0F0] hover:text-[#111]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* 05 — Mascot */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <span className="text-[10px] text-[#888]">05</span>
              <span className="text-[10px] uppercase tracking-[0.18em] text-[#555]">Mascot</span>
              <div className="h-px flex-1 bg-[#E0E0E0]" />
            </div>
            <div className="mb-5 grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: "webswing", emoji: "🕷", label: "Swing" },
                  { id: "headturn", emoji: "🕸", label: "Look" },
                  { id: "github",   icon: "github" as const, label: "Mark" },
                  { id: "copilot",  emoji: "🤖",  label: "Copilot" },
                  { id: "octopuss", emoji: "🐙",  label: "Octo" },
                  { id: "none",     emoji: "—",  label: "None" },
                ] as ({ id: DefaultMascotId; label: string } & ({ emoji: string; icon?: never } | { icon: "github"; emoji?: never }))[]
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => chooseMascot(opt.id)}
                  className={`border py-2.5 text-center transition-colors ${
                    defaultMascot === opt.id
                      ? "border-[#111] bg-[#111] text-white"
                      : "border-[#E0E0E0] text-[#555] hover:border-[#999]"
                  }`}
                >
                  {opt.emoji ? (
                    <span className="block text-base leading-none">{opt.emoji}</span>
                  ) : (
                    <span className="flex justify-center">
                      <GitHubMarkIcon className={`h-5 w-5 ${defaultMascot === opt.id ? "fill-white" : "fill-[#555]"}`} />
                    </span>
                  )}
                  <span className="mt-1 block text-[9px] uppercase tracking-wider leading-none">{opt.label}</span>
                </button>
              ))}
            </div>
            <p className="mb-2 text-[10px] uppercase tracking-[0.15em] text-[#666]">
              Custom SVG <span className="normal-case tracking-normal text-[#888]">(overrides above)</span>
            </p>
            <label className="group block cursor-pointer">
              <input
                type="file"
                accept="image/svg+xml,.svg,.piskel,.json"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadMascot(f).catch((err) => window.alert(err.message));
                }}
              />
              <div
                className={`flex flex-col items-center justify-center border border-dashed px-4 py-5 text-center transition-colors ${
                  mascotUrl
                    ? "border-emerald-400 bg-emerald-50"
                    : "border-[#DCDCDC] bg-[#FAFAFA] group-hover:border-[#999] group-hover:bg-white"
                }`}
              >
                {uploadingMascot ? (
                  <span className="text-[10px] text-[#666]">uploading…</span>
                ) : mascotUrl ? (
                  <>
                    <svg className="mb-1.5 h-4 w-4 text-emerald-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="break-all text-[10px] text-emerald-600">{mascotFileName}</span>
                    <span className="mt-1 text-[10px] text-[#666]">click to replace</span>
                  </>
                ) : (
                  <>
                    <svg className="mb-1.5 h-4 w-4 text-[#888]" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                    <span className="text-xs text-[#666]">click to upload</span>
<span className="text-[10px] text-[#888]">.svg or .piskel (animated)</span>
                  </>
                )}
              </div>
            </label>
            {mascotUrl && (
              <button
                type="button"
                onClick={clearMascot}
                className="mt-2 text-[10px] uppercase tracking-[0.15em] text-[#888] transition-colors hover:text-red-600"
              >
                remove custom mascot
              </button>
            )}
          </div>

          {/* Save */}
          <div className="pb-2">
            <button
              type="button"
              onClick={loadSaved}
              disabled={loadState === "loading"}
              className="mb-3 w-full border border-[#E0E0E0] py-2.5 text-[11px] uppercase tracking-[0.2em] text-[#444] transition-colors hover:border-[#999] hover:text-[#111] disabled:opacity-25"
            >
              {loadState === "loading" ? "loading…" : "load saved card"}
            </button>
            {loadState === "none" && (
              <p className="mb-3 text-right text-[10px] text-[#888]">no saved card yet</p>
            )}
            {loadState === "loaded" && (
              <p className="mb-3 text-right text-[10px] text-emerald-600">saved card restored</p>
            )}
            {loadState === "error" && (
              <p className="mb-3 text-right text-[10px] text-red-600">couldn&apos;t load saved card</p>
            )}
            <button
              onClick={save}
              disabled={!canSave || saving}
              className="w-full bg-[#111] py-3 text-[11px] uppercase tracking-[0.2em] text-white transition-opacity hover:opacity-75 disabled:opacity-25"
            >
              {saving ? "saving…" : "save card"}
            </button>
          </div>

        </div>
      </aside>

      {/* ── Preview ─────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 flex-col px-12 py-10">
          <p className="mb-6 shrink-0 text-[10px] uppercase tracking-[0.2em] text-[#666]">Live preview</p>

          {displayUrl ? (
            <div className="mb-6 flex min-h-0 flex-1 items-start overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={displayUrl} alt="Card preview" className="h-auto max-h-full w-full object-contain object-top" />
            </div>
          ) : (
            <div className="mb-6 flex h-48 shrink-0 items-center justify-center border border-dashed border-[#E4E4E4]">
              <p className="text-xs text-[#777]">enter a username to preview</p>
            </div>
          )}

          {displayUrl && !saveResult && (
            <p className="shrink-0 text-[10px] text-[#666]">Renders via the template engine — no font dependencies.</p>
          )}

          {saveResult && (
            <div className="shrink-0 border-t border-[#E0E0E0] pt-8">
              <p className="mb-3 text-[10px] uppercase tracking-[0.2em] text-[#666]">README embed</p>
              <pre className="break-all whitespace-pre-wrap border border-[#E0E0E0] bg-white p-4 text-xs text-[#333]">{embedCode}</pre>
              <p className="mt-3 text-[10px] text-[#666]">
                Refreshes daily. Versioned URL busts GitHub&apos;s camo cache on config change.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  </div>
  );
}