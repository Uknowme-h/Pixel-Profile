"use client";

import { AppNav } from "@/components/app-nav";
import { EditorCanvas } from "@/components/editor/canvas";
import { Inspector } from "@/components/editor/inspector";
import { Palette } from "@/components/editor/palette";
import { PreviewPane } from "@/components/editor/preview-pane";
import { blockDef, newNodeId } from "@/lib/editor/registry";
import { starterScene } from "@/lib/editor/starter";
import { MAX_NODES, type BuiltInBlockType, type EditorScene, type SceneNode } from "@/lib/editor/types";
import { getBrowserClient } from "@/lib/supabase/browser";
import type { Session } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "pixel-profile-editor-scene";

export default function EditorShell() {
  const supabase = useMemo(() => getBrowserClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [username, setUsername] = useState("");
  const [scene, setScene] = useState<EditorScene>(starterScene);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [embed, setEmbed] = useState<string | null>(null);
  const [saveHint, setSaveHint] = useState<string | null>(null);
  const history = useRef<EditorScene[]>([]);
  const loaded = useRef(false);

  const pushHistory = useCallback((next: EditorScene) => {
    history.current = [...history.current.slice(-40), scene];
    setScene(next);
  }, [scene]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      const gh = data.session?.user.user_metadata?.user_name as string | undefined;
      if (gh) setUsername((p) => p || gh);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      const gh = s?.user.user_metadata?.user_name as string | undefined;
      if (gh) setUsername((p) => p || gh);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    const boot = async () => {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (token) {
        const res = await fetch("/api/editor/scene", { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json().catch(() => null);
        if (data?.scene) {
          setScene(data.scene as EditorScene);
          if (data.username) setUsername(data.username);
          return;
        }
      }
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) setScene(JSON.parse(raw) as EditorScene);
      } catch {
        /* keep starter */
      }
    };
    void boot();
  }, [supabase]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scene));
    } catch {
      /* quota */
    }
  }, [scene]);

  useEffect(() => {
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/editor/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene, username: username.trim() || undefined }),
        });
        const text = await res.text();
        if (!res.ok) {
          setPreviewError(text);
          setSvg(null);
          return;
        }
        setPreviewError(null);
        setSvg(text);
      } catch {
        setPreviewError("preview failed");
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [scene, username]);

  const selected = scene.nodes.find((n) => n.id === selectedId) ?? null;

  const addBlock = useCallback((type: BuiltInBlockType, x?: number, y?: number) => {
    if (scene.nodes.length >= MAX_NODES) return;
    const def = blockDef(type);
    const node: SceneNode = {
      ...def.defaults,
      id: newNodeId(),
      x: x ?? def.defaults.x,
      y: y ?? def.defaults.y,
      z: scene.nodes.reduce((m, n) => Math.max(m, n.z), 0) + 1,
    };
    pushHistory({ ...scene, nodes: [...scene.nodes, node] });
    setSelectedId(node.id);
  }, [scene, pushHistory]);

  const patchNode = useCallback((id: string, patch: Partial<SceneNode>) => {
    setScene((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }, []);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    pushHistory({ ...scene, nodes: scene.nodes.filter((n) => n.id !== selectedId) });
    setSelectedId(null);
  }, [selectedId, scene, pushHistory]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        deleteSelected();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        const prev = history.current.pop();
        if (prev) setScene(prev);
      }
      if (selectedId && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
        e.preventDefault();
        const n = scene.nodes.find((x) => x.id === selectedId);
        if (!n || n.locked) return;
        const d = e.shiftKey ? 8 : 1;
        const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
        const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
        patchNode(selectedId, { x: n.x + dx, y: n.y + dy });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, scene.nodes, deleteSelected, patchNode]);

  const signIn = useCallback(() => {
    supabase?.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/editor` },
    });
  }, [supabase]);

  const save = useCallback(async () => {
    if (!session || !username.trim()) {
      setSaveHint("Sign in and set a username to publish.");
      return;
    }
    setSaving(true);
    setSaveHint(null);
    try {
      const res = await fetch("/api/editor/scene", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ username: username.trim(), scene }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "save failed");
      setEmbed(`[![${username} card](${data.renderUrl as string})]`);
      setSaveHint("Saved. Paste the embed into your README.");
    } catch (err) {
      setSaveHint(err instanceof Error ? err.message : "save failed");
      setEmbed(null);
    } finally {
      setSaving(false);
    }
  }, [session, username, scene]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8F8F8] text-[#111]">
      <header className="flex shrink-0 items-center justify-between border-b border-[#DCDCDC] px-6 py-3">
        <div className="flex items-center gap-8">
          <span className="font-mono text-sm font-medium tracking-tight">pixel profile</span>
          <AppNav />
        </div>
        <div className="flex items-center gap-4">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="github username"
            className="w-40 border-b border-[#E0E0E0] bg-transparent py-1 font-mono text-xs placeholder:text-[#999] focus:border-[#111] focus:outline-none"
          />
          {session ? (
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="bg-[#111] px-3 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save & embed"}
            </button>
          ) : (
            <button type="button" onClick={signIn} className="text-sm hover:opacity-50">
              sign in
            </button>
          )}
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Palette onAdd={(t) => addBlock(t)} />
        <div className="flex min-w-0 min-h-0 flex-1 flex-col">
          <EditorCanvas
            scene={scene}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPatch={patchNode}
            onDropBlock={(type, x, y) => addBlock(type, x, y)}
          />
          <PreviewPane svg={svg} error={previewError} />
        </div>
        <Inspector
          scene={scene}
          node={selected}
          onScene={(patch) => pushHistory({ ...scene, ...patch, background: patch.background ?? scene.background })}
          onNode={(patch) => {
            if (!selectedId) return;
            if ("props" in patch && patch.props) {
              patchNode(selectedId, { props: patch.props });
            } else {
              patchNode(selectedId, patch);
            }
          }}
          onDelete={deleteSelected}
        />
      </div>

      {(saveHint || embed) && (
        <footer className="shrink-0 border-t border-[#DCDCDC] px-6 py-2">
          {saveHint && <p className="text-[11px] text-[#555]">{saveHint}</p>}
          {embed && (
            <input
              readOnly
              value={embed}
              onFocus={(e) => e.currentTarget.select()}
              className="mt-1 w-full bg-transparent font-mono text-[11px] text-[#111] focus:outline-none"
            />
          )}
        </footer>
      )}
    </div>
  );
}
