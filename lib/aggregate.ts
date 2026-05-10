import { breedingWeek } from "@/lib/aviagen";
import { ChartPoint } from "@/components/charts/TimeSeriesChart";

/** Pivot rows into chart-ready time-series points. */
export function aggregateByWeek<T extends { measured_at?: string; recorded_on?: string; week_start_date?: string }>(
  rows: T[],
  options: {
    projectStart: string | null;
    groupKey: (row: T) => string | null;       // e.g. row => row.location_id, or row => sex
    valueKey: (row: T) => number | null;       // numeric value to average
    groupLabels: Record<string, string>;       // map group id → display name
  }
): { data: ChartPoint[]; series: { key: string; name: string }[] } {
  // Bucket rows by (week, group) → array of values
  const buckets: Record<number, Record<string, number[]>> = {};
  const groupsSeen = new Set<string>();

  for (const row of rows) {
    const date = row.measured_at ?? row.recorded_on ?? row.week_start_date ?? null;
    if (!date) continue;
    const week = options.projectStart ? breedingWeek(date, options.projectStart) : 0;
    if (week <= 0) continue;
    const group = options.groupKey(row);
    if (!group) continue;
    const value = options.valueKey(row);
    if (value === null || isNaN(value)) continue;

    if (!buckets[week]) buckets[week] = {};
    if (!buckets[week][group]) buckets[week][group] = [];
    buckets[week][group].push(value);
    groupsSeen.add(group);
  }

  const sortedWeeks = Object.keys(buckets).map(Number).sort((a, b) => a - b);
  const data: ChartPoint[] = sortedWeeks.map(week => {
    const point: ChartPoint = { label: `Εβδ. ${week}` };
    for (const group of groupsSeen) {
      const values = buckets[week]?.[group];
      point[group] = values && values.length
        ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
        : null;
    }
    return point;
  });

  const series = Array.from(groupsSeen)
    .sort()
    .map(g => ({ key: g, name: options.groupLabels[g] ?? g }));

  return { data, series };
}
