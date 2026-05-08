"use client";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export default function WeightChart({ data }: { data: { month: string; avg: number }[] }) {
  if (!data.length) return <div className="flex items-center justify-center h-48 text-gray-500 text-sm">No data yet</div>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="month" tick={{ fill: "#9ca3af", fontSize: 11 }} />
        <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} unit=" kg" />
        <Tooltip
          contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: 8 }}
          labelStyle={{ color: "#e5e7eb" }}
          itemStyle={{ color: "#34d399" }}
        />
        <Line type="monotone" dataKey="avg" stroke="#34d399" strokeWidth={2} dot={{ fill: "#34d399", r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
