"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceArea } from "recharts";

const COLORS = [
  "#34d399", "#60a5fa", "#f59e0b", "#f87171",
  "#a78bfa", "#22d3ee", "#fb7185", "#84cc16",
];

export interface ChartPoint {
  // The x-axis value (e.g. "2026-W20" or "Εβδ. 2"). Already pre-formatted on server.
  label: string;
  // Series values keyed by series name
  [key: string]: number | string | null;
}

interface Props {
  data: ChartPoint[];
  series: { key: string; name: string }[];
  yUnit?: string;
  height?: number;
  yMin?: number;
  yMax?: number;
  // Optional reference band drawn behind series (e.g. Aviagen target range)
  band?: { y1: number; y2: number; label?: string };
}

export default function TimeSeriesChart({ data, series, yUnit, height = 260, yMin, yMax, band }: Props) {
  if (!data.length) {
    return <div className="flex items-center justify-center h-48 text-gray-500 text-sm">Δεν υπάρχουν δεδομένα ακόμα</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          unit={yUnit ? ` ${yUnit}` : undefined}
          domain={[yMin ?? "auto", yMax ?? "auto"]}
        />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          itemStyle={{ color: "#e5e7eb" }}
        />
        {band && (
          <ReferenceArea y1={band.y1} y2={band.y2} fill="#34d399" fillOpacity={0.08} stroke="#34d39933" />
        )}
        {series.length > 1 && <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={COLORS[i % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
