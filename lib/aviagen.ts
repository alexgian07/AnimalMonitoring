import { AviagenTarget } from "@/lib/types";

/**
 * Returns the breeding week number (1-indexed) for a given date,
 * given the project start date. Returns 0 if the project hasn't started.
 */
export function breedingWeek(forDate: Date | string, projectStart: Date | string): number {
  const target = typeof forDate === "string" ? new Date(forDate) : forDate;
  const start  = typeof projectStart === "string" ? new Date(projectStart) : projectStart;

  // Days since start (use UTC midnight to avoid TZ drift)
  const dayMs = 1000 * 60 * 60 * 24;
  const days = Math.floor((target.getTime() - start.getTime()) / dayMs);
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/**
 * Returns the matching Aviagen target row for a given week.
 * The Excel table covers weeks 1..9+, where 9+ is open-ended.
 */
export function aviagenForWeek(week: number, targets: AviagenTarget[]): AviagenTarget | null {
  if (week <= 0) return null;
  // Find row where week falls in [week_start, week_end] (or week >= week_start && week_end is null)
  for (const t of targets) {
    if (week >= t.week_start && (t.week_end === null || week <= t.week_end)) {
      return t;
    }
  }
  return null;
}

export type DeviationStatus = "ok" | "high" | "low" | "unknown";

export function tempStatus(measured: number | null, target: AviagenTarget | null): DeviationStatus {
  if (measured === null || target === null) return "unknown";
  if (measured > target.temp_max) return "high";
  if (measured < target.temp_min) return "low";
  return "ok";
}

export function humidStatus(measured: number | null, target: AviagenTarget | null): DeviationStatus {
  if (measured === null || target === null) return "unknown";
  if (measured > target.humid_max) return "high";
  if (measured < target.humid_min) return "low";
  return "ok";
}
