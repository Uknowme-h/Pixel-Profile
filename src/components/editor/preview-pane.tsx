"use client";

export function PreviewPane({ svg, error }: { svg: string | null; error: string | null }) {
  return (
    <div className="flex h-[180px] shrink-0 flex-col border-t border-[#DCDCDC] bg-[#F8F8F8]">
      <div className="flex items-center justify-between border-b border-[#E8E8E8] px-4 py-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777]">GitHub preview</p>
        <p className="text-[10px] text-[#999]">Compiled SVG — what Camo will show</p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[#E8E8E4] p-3">
        {error && <p className="font-mono text-xs text-red-700">{error}</p>}
        {!error && !svg && <p className="text-xs text-[#999]">compiling…</p>}
        {svg && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
            alt="Compiled README card"
            className="max-h-full max-w-full"
          />
        )}
      </div>
    </div>
  );
}
