"use client";

import { ANIMATION_PRESETS, defaultMotionDur, usesAmount } from "@/lib/editor/animations";
import type { AnimationPresetId, EditorScene, SceneNode } from "@/lib/editor/types";
import { useRef } from "react";

export function Inspector({
  scene,
  node,
  onScene,
  onNode,
  onDelete,
  onBringFront,
  onSendBack,
}: {
  scene: EditorScene;
  node: SceneNode | null;
  onScene: (patch: Partial<EditorScene>) => void;
  onNode: (patch: Partial<SceneNode> | { props: SceneNode["props"] }) => void;
  onDelete: () => void;
  onBringFront?: () => void;
  onSendBack?: () => void;
}) {
  return (
    <aside className="flex w-[240px] shrink-0 flex-col overflow-y-auto border-l border-[#DCDCDC] bg-[#F8F8F8]">
      <div className="border-b border-[#DCDCDC] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Inspect</p>
      </div>
      <section className="space-y-3 border-b border-[#E8E8E8] px-4 py-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#999]">Sheet</p>
        <ColorField
          label="Fill"
          value={scene.background.fill}
          allowNone
          onChange={(v) => onScene({ background: { ...scene.background, fill: v } })}
        />
        <div className="flex gap-2 text-[11px] text-[#777]">
          <label>
            W
            <input
              type="number"
              min={200}
              max={1280}
              value={scene.width}
              onChange={(e) => onScene({ width: Number(e.target.value) })}
              className="ml-1 w-16 border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-[#111] focus:border-[#111] focus:outline-none"
            />
          </label>
          <label>
            H
            <input
              type="number"
              min={200}
              max={640}
              value={scene.height}
              onChange={(e) => onScene({ height: Number(e.target.value) })}
              className="ml-1 w-16 border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-[#111] focus:border-[#111] focus:outline-none"
            />
          </label>
        </div>
      </section>
      {!node ? (
        <p className="px-4 py-6 text-[12px] leading-relaxed text-[#999]">
          Select a block on the sheet. GitHub tokens like <code className="font-mono text-[#111]">{"{{stats.commits}}"}</code> resolve when the SVG compiles.
        </p>
      ) : (
        <section className="space-y-3 px-4 py-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#999]">{node.type}</p>
            <button type="button" onClick={onDelete} className="text-[11px] text-[#777] hover:text-[#111]">
              Delete
            </button>
          </div>
          <label className="block text-[11px] text-[#777]">
            Motion
            <select
              value={node.animation ?? "none"}
              onChange={(e) => onNode({ animation: e.target.value as AnimationPresetId, animDur: undefined })}
              className="mt-1 block w-full border border-[#E0E0E0] bg-white px-2 py-1.5 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
            >
              {ANIMATION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </label>
          {node.animation && node.animation !== "none" && (
            <div className="grid grid-cols-3 gap-2 text-[11px] text-[#777]">
              <label>
                Time
                <input
                  type="number"
                  min={0.2}
                  max={20}
                  step={0.1}
                  value={node.animDur ?? defaultMotionDur(node.animation)}
                  onChange={(e) => onNode({ animDur: Number(e.target.value) })}
                  className="mt-0.5 block w-full border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
                />
              </label>
              <label>
                Delay
                <input
                  type="number"
                  min={0}
                  max={12}
                  step={0.1}
                  value={node.animDelay ?? 0}
                  onChange={(e) => onNode({ animDelay: Number(e.target.value) })}
                  className="mt-0.5 block w-full border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
                />
              </label>
              {usesAmount(node.animation) ? (
                <label>
                  Amount
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={node.animAmount ?? 50}
                    onChange={(e) => onNode({ animAmount: Number(e.target.value) })}
                    className="mt-0.5 block w-full border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
                  />
                </label>
              ) : (
                <span />
              )}
            </div>
          )}
          {node.type === "text" && (
            <>
              <label className="block text-[11px] text-[#777]">
                Text
                <textarea
                  value={String(node.props.content ?? "")}
                  onChange={(e) => onNode({ props: { ...node.props, content: e.target.value } })}
                  rows={3}
                  placeholder="Type anything. Use {{name}} or {{stats.commits}} to pull GitHub data."
                  className="mt-1 block w-full resize-y border border-[#E0E0E0] bg-white px-2 py-1.5 font-mono text-xs text-[#111] placeholder:text-[#bbb] focus:border-[#111] focus:outline-none"
                />
              </label>
              <p className="text-[10px] leading-snug text-[#999]">
                Double-click the block on the sheet to type there too.
              </p>
              <label className="block text-[11px] text-[#777]">
                Size
                <input
                  type="number"
                  min={8}
                  max={96}
                  value={Number(node.props.fontSize ?? 22)}
                  onChange={(e) => onNode({ props: { ...node.props, fontSize: Number(e.target.value) } })}
                  className="ml-2 w-16 border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
                />
              </label>
            </>
          )}
          {typeof node.props.content === "string" && node.type !== "text" && (
            <Field label="Content" value={String(node.props.content)} onChange={(v) => onNode({ props: { ...node.props, content: v } })} />
          )}
          {typeof node.props.label === "string" && (
            <Field label="Label" value={String(node.props.label)} onChange={(v) => onNode({ props: { ...node.props, label: v } })} />
          )}
          {typeof node.props.value === "string" && (
            <Field label="Value" value={String(node.props.value)} onChange={(v) => onNode({ props: { ...node.props, value: v } })} />
          )}
          {typeof node.props.fill === "string" && (
            <ColorField
              label="Fill"
              value={String(node.props.fill)}
              allowNone
              onChange={(v) => onNode({ props: { ...node.props, fill: v } })}
            />
          )}
          {(node.type === "shape.ellipse" || node.type === "shape.rect") && (
            <label className="block text-[11px] text-[#777]">
              Opacity
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={Number(node.props.opacity ?? 1)}
                onChange={(e) => onNode({ props: { ...node.props, opacity: Number(e.target.value) } })}
                className="ml-2 w-16 border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
              />
            </label>
          )}
          {typeof node.props.accent === "string" && (
            <ColorField label="Accent" value={String(node.props.accent)} onChange={(v) => onNode({ props: { ...node.props, accent: v } })} />
          )}
          {typeof node.props.text === "string" && node.type !== "languageBar" && (
            <ColorField label="Text" value={String(node.props.text)} onChange={(v) => onNode({ props: { ...node.props, text: v } })} />
          )}
          {node.type === "languageBar" && (
            <ColorField
              label="Text"
              value={String(node.props.text ?? node.props.muted ?? "#f5f5f0")}
              onChange={(v) => onNode({ props: { ...node.props, text: v } })}
            />
          )}
          {typeof node.props.stroke === "string" && (
            <ColorField label="Stroke" value={String(node.props.stroke)} onChange={(v) => onNode({ props: { ...node.props, stroke: v } })} />
          )}
          {typeof node.props.bar === "string" && (
            <ColorField label="Bar" value={String(node.props.bar)} onChange={(v) => onNode({ props: { ...node.props, bar: v } })} />
          )}
          {node.type === "sprite" && (
            <p className="font-mono text-[11px] text-[#777]">
              {Number(node.props.frames ?? 1)} frames · {Number(node.props.fw ?? 0)}×{Number(node.props.fh ?? 0)} · {String(node.props.fps ?? "")} fps
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBringFront}
              className="flex-1 border border-[#E0E0E0] bg-white px-2 py-1.5 text-[11px] hover:border-[#111]"
            >
              Bring front
            </button>
            <button
              type="button"
              onClick={onSendBack}
              className="flex-1 border border-[#E0E0E0] bg-white px-2 py-1.5 text-[11px] hover:border-[#111]"
            >
              Send back
            </button>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-[#777]">
            <input
              type="checkbox"
              checked={node.locked === true}
              onChange={(e) => onNode({ locked: e.target.checked })}
            />
            Lock
          </label>
        </section>
      )}
    </aside>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block text-[11px] text-[#777]">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full border-b border-[#E0E0E0] bg-transparent py-1 font-mono text-xs text-[#111] focus:border-[#111] focus:outline-none"
      />
    </label>
  );
}

function ColorField({
  label,
  value,
  onChange,
  allowNone = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  allowNone?: boolean;
}) {
  const none = value === "none" || value === "transparent";
  const hex = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#111111";
  const last = useRef(hex);
  if (!none) last.current = hex;
  return (
    <label className="flex items-center justify-between text-[11px] text-[#777]">
      {label}
      <span className="flex items-center gap-2">
        {allowNone && (
          <button
            type="button"
            title="Transparent"
            aria-pressed={none}
            onClick={() => onChange(none ? last.current : "none")}
            className={`h-6 w-6 border ${none ? "border-[#111]" : "border-[#DCDCDC]"} ed-swatch-clear`}
          />
        )}
        <input
          type="color"
          value={hex}
          disabled={none}
          onChange={(e) => onChange(e.target.value)}
          className="h-6 w-8 cursor-pointer border border-[#DCDCDC] disabled:cursor-not-allowed disabled:opacity-40"
        />
        <input
          value={none ? "none" : value}
          onChange={(e) => onChange(e.target.value.trim() || "none")}
          className="w-20 border-b border-[#E0E0E0] bg-transparent py-0.5 font-mono text-[10px] text-[#111] focus:border-[#111] focus:outline-none"
        />
      </span>
    </label>
  );
}
