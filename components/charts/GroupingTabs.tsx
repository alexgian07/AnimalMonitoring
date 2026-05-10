"use client";
import { t } from "@/lib/i18n";

export type Grouping = "cell" | "sex" | "overall";

export default function GroupingTabs({ value, onChange }: { value: Grouping; onChange: (g: Grouping) => void }) {
  const opts: { v: Grouping; label: string }[] = [
    { v: "cell",    label: t.stats.groupByCell },
    { v: "sex",     label: t.stats.groupBySex },
    { v: "overall", label: t.stats.groupByOverall },
  ];
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-500 mr-1">{t.stats.groupBy}:</span>
      {opts.map(o => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
            value === o.v
              ? "bg-emerald-600 border-emerald-600 text-white"
              : "border-gray-700 text-gray-400 hover:border-gray-500"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
