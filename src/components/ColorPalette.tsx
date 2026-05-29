"use client";

interface ColorPaletteProps {
  colors: string[];
}

export function ColorPalette({ colors }: ColorPaletteProps) {
  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => navigator.clipboard.writeText(color)}
          className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-xs font-semibold text-slate-600 transition hover:-translate-y-0.5 hover:shadow-md"
          title={`复制 ${color}`}
        >
          <span className="h-12 w-12 rounded-full border border-slate-200" style={{ backgroundColor: color }} />
          {color}
        </button>
      ))}
    </div>
  );
}
