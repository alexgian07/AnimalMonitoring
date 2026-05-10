"use client";
import { useMemo, useState } from "react";
import TimeSeriesChart, { ChartPoint } from "./TimeSeriesChart";
import GroupingTabs, { Grouping } from "./GroupingTabs";
import { breedingWeek } from "@/lib/aviagen";

interface RawRow {
  date: string;
  value: number | null;
  location_id: string;
  sex?: string | null;
}

interface Props {
  title: string;
  subtitle?: string;
  rows: RawRow[];
  cellLabels: Record<string, string>;          // location_id → "Κελί 1"
  projectStart: string | null;
  yUnit?: string;
  band?: { y1: number; y2: number };
  defaultGrouping?: Grouping;
}

const SEX_LABELS: Record<string, string> = {
  M: "Άρρεν",
  F: "Θήλυ",
  Unknown: "Άγνωστο",
};

export default function MultiGroupChart({
  title, subtitle, rows, cellLabels, projectStart, yUnit, band, defaultGrouping = "cell",
}: Props) {
  const [grouping, setGrouping] = useState<Grouping>(defaultGrouping);

  const { data, series } = useMemo(() => {
    if (!projectStart) return { data: [] as ChartPoint[], series: [] as { key: string; name: string }[] };

    const groupKey = (r: RawRow): string | null => {
      if (grouping === "cell")    return r.location_id ?? null;
      if (grouping === "sex")     return r.sex ?? null;
      if (grouping === "overall") return "all";
      return null;
    };
    const groupLabels: Record<string, string> = grouping === "cell"
      ? cellLabels
      : grouping === "sex"
        ? SEX_LABELS
        : { all: "Σύνολο" };

    const buckets: Record<number, Record<string, number[]>> = {};
    const groupsSeen = new Set<string>();

    for (const r of rows) {
      if (r.value === null) continue;
      const week = breedingWeek(r.date, projectStart);
      if (week <= 0) continue;
      const g = groupKey(r);
      if (!g) continue;
      buckets[week] ??= {};
      buckets[week][g] ??= [];
      buckets[week][g].push(r.value);
      groupsSeen.add(g);
    }

    const sortedWeeks = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    const out: ChartPoint[] = sortedWeeks.map(w => {
      const pt: ChartPoint = { label: `Εβδ. ${w}` };
      for (const g of groupsSeen) {
        const vals = buckets[w]?.[g];
        pt[g] = vals && vals.length
          ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2))
          : null;
      }
      return pt;
    });

    const seriesArr = Array.from(groupsSeen).sort().map(g => ({
      key: g,
      name: groupLabels[g] ?? g,
    }));

    return { data: out, series: seriesArr };
  }, [rows, grouping, cellLabels, projectStart]);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-semibold text-white">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <GroupingTabs value={grouping} onChange={setGrouping} />
      </div>
      <TimeSeriesChart data={data} series={series} yUnit={yUnit} band={band} />
    </div>
  );
}
