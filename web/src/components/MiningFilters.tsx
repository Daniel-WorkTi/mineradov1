import { MINING_PRESETS } from "../miningFilters";
import type { MiningPreset } from "../types";

interface MiningFiltersProps {
  preset: MiningPreset;
  onPresetChange: (p: MiningPreset) => void;
  counts: Partial<Record<MiningPreset, number>>;
}

const chipBase =
  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors";
const chipIdle = "border-zinc-800 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200";
const chipActive = "border-zinc-500 bg-zinc-100 text-zinc-950";

export function MiningFilters({
  preset,
  onPresetChange,
  counts,
}: MiningFiltersProps) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        Filtros
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${chipBase} ${preset === "all" ? chipActive : chipIdle}`}
          onClick={() => onPresetChange("all")}
        >
          Todos
        </button>
        {MINING_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.description}
            className={`${chipBase} max-w-full ${preset === p.id ? chipActive : chipIdle}`}
            onClick={() => onPresetChange(p.id)}
          >
            {p.label}
            {counts[p.id] !== undefined && (
              <span className="ml-1 opacity-70">({counts[p.id]})</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
