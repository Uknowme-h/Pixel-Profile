"use client";

import { BLOCK_REGISTRY } from "@/lib/editor/registry";
import type { BuiltInBlockType } from "@/lib/editor/types";

const MIME = "application/x-pixel-block";

export function Palette({ onAdd }: { onAdd: (type: BuiltInBlockType) => void }) {
  const groups = [
    { id: "content" as const, label: "Type" },
    { id: "data" as const, label: "GitHub" },
    { id: "shape" as const, label: "Shapes" },
  ];
  return (
    <aside className="flex w-[200px] shrink-0 flex-col overflow-y-auto border-r border-[#DCDCDC] bg-[#F8F8F8]">
      <div className="border-b border-[#DCDCDC] px-4 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">Blocks</p>
        <p className="mt-1 text-[11px] leading-snug text-[#999]">Drag onto the sheet, or click to stamp.</p>
      </div>
      {groups.map((g) => (
        <div key={g.id} className="border-b border-[#E8E8E8] px-3 py-3">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-[#999]">{g.label}</p>
          <div className="flex flex-col gap-1">
            {BLOCK_REGISTRY.filter((b) => b.category === g.id).map((b) => (
              <button
                key={b.type}
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(MIME, b.type);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onAdd(b.type)}
                className="flex flex-col items-start border border-transparent px-2 py-1.5 text-left hover:border-[#111] hover:bg-white"
              >
                <span className="text-xs text-[#111]">{b.label}</span>
                <span className="text-[10px] text-[#999]">{b.hint}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

export const BLOCK_MIME = MIME;
