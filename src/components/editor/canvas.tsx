"use client";

import { BLOCK_MIME } from "@/components/editor/palette";
import { canvasMotionStyle } from "@/lib/editor/animations";
import { SNAP, type BuiltInBlockType, type EditorScene, type SceneNode } from "@/lib/editor/types";
import { useCallback, useRef, useState, type CSSProperties, type ReactNode } from "react";

function snap(n: number): number {
  return Math.round(n / SNAP) * SNAP;
}

type Drag =
  | { kind: "move"; id: string; ox: number; oy: number }
  | { kind: "resize"; id: string; ox: number; oy: number; ow: number; oh: number };

export function EditorCanvas({
  scene,
  selectedId,
  onSelect,
  onPatch,
  onDropBlock,
  onDropGif,
  onRaise,
}: {
  scene: EditorScene;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onPatch: (id: string, patch: Partial<SceneNode>) => void;
  onDropBlock: (type: BuiltInBlockType, x: number, y: number) => void;
  onDropGif?: (file: File, x: number, y: number) => void;
  onRaise?: (id: string) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const clearBoard = scene.background.fill === "none" || scene.background.fill === "transparent";

  const clientToBoard = useCallback((clientX: number, clientY: number) => {
    const el = boardRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    const sx = scene.width / r.width;
    const sy = scene.height / r.height;
    return { x: (clientX - r.left) * sx, y: (clientY - r.top) * sy };
  }, [scene.width, scene.height]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      const p = clientToBoard(e.clientX, e.clientY);
      if (drag.kind === "move") {
        onPatch(drag.id, { x: snap(p.x - drag.ox), y: snap(p.y - drag.oy) });
      } else {
        onPatch(drag.id, {
          w: Math.max(SNAP * 2, snap(drag.ow + (p.x - drag.ox))),
          h: Math.max(SNAP * 2, snap(drag.oh + (p.y - drag.oy))),
        });
      }
    },
    [drag, clientToBoard, onPatch],
  );

  return (
    <div className="relative min-h-0 flex-1 overflow-auto bg-[#E8E8E4]">
      <div className="flex min-h-full items-center justify-center p-8">
        <div
          ref={boardRef}
          className={`relative shrink-0 shadow-[8px_8px_0_#111] ${clearBoard ? "ed-swatch-clear" : ""}`}
          style={{
            width: scene.width,
            height: scene.height,
            backgroundColor: clearBoard ? undefined : scene.background.fill,
            backgroundImage: clearBoard
              ? undefined
              : "linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px)",
            backgroundSize: clearBoard ? undefined : `${SNAP}px ${SNAP}px`,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={() => setDrag(null)}
          onPointerLeave={() => setDrag(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingId(null);
              onSelect(null);
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={(e) => {
            e.preventDefault();
            const gif = [...e.dataTransfer.files].find(
              (f) => f.type === "image/gif" || f.name.toLowerCase().endsWith(".gif"),
            );
            if (gif) {
              const p = clientToBoard(e.clientX, e.clientY);
              onDropGif?.(gif, snap(p.x), snap(p.y));
              return;
            }
            const type = e.dataTransfer.getData(BLOCK_MIME) as BuiltInBlockType;
            if (!type) return;
            const p = clientToBoard(e.clientX, e.clientY);
            onDropBlock(type, snap(p.x), snap(p.y));
          }}
        >
          {[...scene.nodes]
            .filter((n) => n.visible !== false)
            .sort((a, b) => a.z - b.z)
            .map((n) => (
              <NodeView
                key={n.id}
                node={n}
                selected={n.id === selectedId}
                editing={n.id === editingId}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onSelect(n.id);
                  onRaise?.(n.id);
                  if (n.locked || n.id === editingId) return;
                  const p = clientToBoard(e.clientX, e.clientY);
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setDrag({ kind: "move", id: n.id, ox: p.x - n.x, oy: p.y - n.y });
                }}
                onDoubleClick={() => {
                  if (n.type !== "text" || n.locked) return;
                  setDrag(null);
                  setEditingId(n.id);
                  onSelect(n.id);
                }}
                onResizeDown={(e) => {
                  e.stopPropagation();
                  onSelect(n.id);
                  const p = clientToBoard(e.clientX, e.clientY);
                  setDrag({ kind: "resize", id: n.id, ox: p.x, oy: p.y, ow: n.w, oh: n.h });
                }}
                onChangeContent={(content) => {
                  onPatch(n.id, { props: { ...n.props, content } });
                }}
                onStopEdit={() => setEditingId(null)}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

function NodeView({
  node,
  selected,
  editing,
  onPointerDown,
  onDoubleClick,
  onResizeDown,
  onChangeContent,
  onStopEdit,
}: {
  node: SceneNode;
  selected: boolean;
  editing: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onDoubleClick: () => void;
  onResizeDown: (e: React.PointerEvent) => void;
  onChangeContent: (content: string) => void;
  onStopEdit: () => void;
}) {
  return (
    <div
      className={`absolute touch-none ${editing ? "cursor-text" : "cursor-grab"}`}
      style={{
        left: node.x,
        top: node.y,
        width: node.w,
        height: node.h,
        zIndex: node.z,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        outline: selected || editing ? "1px solid #c8f54a" : "1px solid transparent",
        outlineOffset: 2,
      }}
      onPointerDown={editing ? (e) => e.stopPropagation() : onPointerDown}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick();
      }}
    >
      {editing && node.type === "text" ? (
        <textarea
          autoFocus
          value={String(node.props.content ?? "")}
          onChange={(e) => onChangeContent(e.target.value)}
          onBlur={onStopEdit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Escape") onStopEdit();
          }}
          className="h-full w-full resize-none bg-transparent font-mono leading-none focus:outline-none"
          style={{
            color: String(node.props.fill ?? "#f5f5f0"),
            fontSize: Number(node.props.fontSize ?? 22),
          }}
        />
      ) : (
        <MotionShell node={node}>
          <NodeFace node={node} />
        </MotionShell>
      )}
      {selected && !editing && (
        <button
          type="button"
          aria-label="Resize"
          className="absolute -right-1.5 -bottom-1.5 h-3 w-3 cursor-nwse-resize bg-[#c8f54a]"
          onPointerDown={onResizeDown}
        />
      )}
    </div>
  );
}

function MotionShell({ node, children }: { node: SceneNode; children: ReactNode }) {
  const motion = canvasMotionStyle(node);
  if (!motion) return children;
  return (
    <div className={`h-full w-full ${motion.className}`} style={motion.style as CSSProperties}>
      {children}
    </div>
  );
}

function NodeFace({ node }: { node: SceneNode }) {
  const fill = String(node.props.fill ?? "#c8f54a");
  const clearFill = fill === "none" || fill === "transparent";
  const text = String(node.props.text ?? "#f5f5f0");
  const accent = String(node.props.accent ?? "#c8f54a");
  const opacity = Number(node.props.opacity ?? 1);
  if (node.type === "text") {
    return (
      <div
        className="h-full w-full overflow-hidden font-mono leading-none"
        style={{ color: String(node.props.fill ?? "#f5f5f0"), fontSize: Number(node.props.fontSize ?? 22), whiteSpace: "pre-wrap" }}
      >
        {String(node.props.content ?? "")}
      </div>
    );
  }
  if (node.type === "shape.rect") {
    return (
      <div
        className={`h-full w-full ${clearFill ? "ed-swatch-clear" : ""}`}
        style={{
          background: clearFill ? undefined : fill,
          borderRadius: Number(node.props.radius ?? 0),
          opacity,
        }}
      />
    );
  }
  if (node.type === "shape.ellipse") {
    return (
      <div
        className={`h-full w-full ${clearFill ? "ed-swatch-clear" : ""}`}
        style={{
          background: clearFill ? undefined : fill,
          borderRadius: "50%",
          opacity,
        }}
      />
    );
  }
  if (node.type === "shape.line") {
    return (
      <div className="flex h-full w-full items-center">
        <div className="h-0.5 w-full" style={{ background: String(node.props.stroke ?? accent) }} />
      </div>
    );
  }
  if (node.type === "socialButton") {
    return (
      <div className="flex h-full w-full items-center justify-center font-mono text-xs font-bold" style={{ background: fill, color: text }}>
        {String(node.props.label ?? "badge")}
      </div>
    );
  }
  if (node.type === "statPill") {
    return (
      <div className="flex h-full flex-col justify-center gap-1 border px-3 font-mono" style={{ background: fill, borderColor: accent, color: text }}>
        <span className="text-[10px] uppercase tracking-wider" style={{ color: accent }}>{String(node.props.label ?? "stat")}</span>
        <span className="text-sm font-bold">{String(node.props.value ?? "0")}</span>
      </div>
    );
  }
  if (node.type === "statRow") {
    return (
      <div className="flex h-full gap-2 font-mono text-[10px]" style={{ color: text }}>
        {["commits", "prs", "issues"].map((l) => (
          <div key={l} className="flex flex-1 flex-col justify-center border px-2" style={{ background: fill, borderColor: accent }}>
            <span style={{ color: accent }}>{l}</span>
            <span>{"{{stats}}"}</span>
          </div>
        ))}
      </div>
    );
  }
  if (node.type === "sprite") {
    const sheet = String(node.props.sheet ?? "");
    const frames = Math.max(1, Number(node.props.frames ?? 1));
    return (
      <div
        className="h-full w-full"
        style={{
          backgroundImage: sheet ? `url(${sheet})` : undefined,
          backgroundColor: sheet ? undefined : "#1c1c1a",
          backgroundSize: `${frames * 100}% 100%`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "0 0",
          imageRendering: "pixelated",
        }}
      />
    );
  }
  if (node.type === "languageBar") {
    const textColor = String(node.props.text ?? node.props.muted ?? "#9a9a90");
    const rows = [
      ["TypeScript", "75%"],
      ["Jupyter Notebook", "50%"],
      ["Rust", "35%"],
    ];
    return (
      <div className="flex h-full min-w-0 flex-col justify-center gap-1 overflow-hidden font-mono text-[10px]">
        {rows.map(([l, w]) => (
          <div key={l} className="flex min-w-0 items-center gap-2">
            <span className="w-[38%] shrink-0 truncate" style={{ color: textColor }} title={l}>
              {l}
            </span>
            <span className="h-1.5 min-w-0 rounded-sm" style={{ width: w, background: String(node.props.bar ?? "#c8f54a") }} />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col justify-center gap-1 font-mono text-[10px] text-[#9a9a90]">
      <span>TypeScript</span>
      <span className="h-1.5 w-3/4" style={{ background: String(node.props.bar ?? "#c8f54a") }} />
      <span>Rust</span>
      <span className="h-1.5 w-1/2" style={{ background: String(node.props.bar ?? "#c8f54a") }} />
    </div>
  );
}
