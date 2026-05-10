import { createServerClient } from "@/lib/supabase/server";
import MultiGroupChart from "@/components/charts/MultiGroupChart";
import ExportButton from "@/components/ExportButton";
import { t } from "@/lib/i18n";
import { breedingWeek, aviagenForWeek } from "@/lib/aviagen";

export default async function StatsPage() {
  const supabase = await createServerClient();

  const [
    { data: locations },
    { data: turkeys },
    { data: measurements },
    { data: dailyTemps },
    { data: feedLogs },
    { data: aviagen },
    { data: settings },
  ] = await Promise.all([
    supabase.from("locations").select("*").order("position"),
    supabase.from("turkeys").select("id, sex, location_id").is("deleted_at", null),
    supabase.from("measurements").select("*").is("deleted_at", null).order("measured_at"),
    supabase.from("daily_temperatures").select("*").is("deleted_at", null).order("recorded_on"),
    supabase.from("feed_logs").select("*").is("deleted_at", null).order("week_number"),
    supabase.from("aviagen_targets").select("*").order("week_start"),
    supabase.from("app_settings").select("project_start_date").eq("id", 1).single(),
  ]);

  const projectStart = settings?.project_start_date ?? null;

  // Build cell labels map
  const cellLabels: Record<string, string> = {};
  for (const l of locations ?? []) cellLabels[l.id] = l.name;

  // Build turkey → sex map for joining sex onto measurements
  const turkeySex: Record<string, string> = {};
  for (const tk of turkeys ?? []) turkeySex[tk.id] = tk.sex ?? "Unknown";

  // Helper: build a flattened raw-row array for any numeric field on measurements
  const measurementRows = (field: string) => (measurements ?? []).map((m: any) => ({
    date: m.measured_at,
    value: m[field] ?? null,
    location_id: m.location_id,
    sex: turkeySex[m.turkey_id] ?? null,
  }));

  // Daily temp rows (use temp_max as the comparable value to Aviagen)
  const tempRows = (dailyTemps ?? []).map((r: any) => ({
    date: r.recorded_on,
    value: r.temp_max ?? r.temp_midday ?? r.temp_morning ?? null,
    location_id: r.location_id,
    sex: null,
  }));

  // FCR data from feed_logs (no sex grouping — feed is per pen)
  const fcrRows = (feedLogs ?? [])
    .filter((l: any) => l.feeder_label === "main") // main feeder only for primary FCR view
    .map((l: any) => ({
      date: l.week_start_date,
      value: l.consumption_kg && l.weight_gain_kg && l.weight_gain_kg > 0
        ? Number((l.consumption_kg / l.weight_gain_kg).toFixed(2))
        : null,
      location_id: l.location_id,
      sex: null,
    }));

  // Aviagen target band — pick the WIDEST range observed across the dataset's weeks for visual context
  let band: { y1: number; y2: number } | undefined = undefined;
  if (projectStart && aviagen?.length) {
    const allWeeks = (dailyTemps ?? []).map((r: any) => breedingWeek(r.recorded_on, projectStart)).filter(w => w > 0);
    if (allWeeks.length) {
      const w = allWeeks[Math.floor(allWeeks.length / 2)];   // median-ish week
      const target = aviagenForWeek(w, aviagen);
      if (target) band = { y1: target.temp_min, y2: target.temp_max };
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">{t.stats.title}</h1>
          <p className="text-gray-400 text-sm">{t.stats.subtitle}</p>
        </div>
        <ExportButton />
      </div>

      {/* Weight */}
      <MultiGroupChart
        title={t.stats.weight}
        subtitle="kg ανά εβδομάδα"
        rows={measurementRows("weight_kg")}
        cellLabels={cellLabels}
        projectStart={projectStart}
        yUnit="kg"
      />

      {/* Body measurements grid */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h2 className="font-semibold text-white mb-4">{t.stats.bodyMeasurements}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MultiGroupChart title={t.stats.metatarsus}  rows={measurementRows("metatarsus_length_mm")}   cellLabels={cellLabels} projectStart={projectStart} yUnit="mm" />
          <MultiGroupChart title={t.stats.metatarsusD} rows={measurementRows("metatarsus_diameter_mm")} cellLabels={cellLabels} projectStart={projectStart} yUnit="mm" />
          <MultiGroupChart title={t.stats.chestWidth}  rows={measurementRows("chest_width_mm")}         cellLabels={cellLabels} projectStart={projectStart} yUnit="mm" />
          <MultiGroupChart title={t.stats.keelLength}  rows={measurementRows("keel_length_mm")}         cellLabels={cellLabels} projectStart={projectStart} yUnit="mm" />
          <div className="lg:col-span-2">
            <MultiGroupChart title={t.stats.bodyLength} rows={measurementRows("body_length_mm")} cellLabels={cellLabels} projectStart={projectStart} yUnit="mm" />
          </div>
        </div>
      </div>

      {/* FCR */}
      <MultiGroupChart
        title={t.stats.fcr}
        subtitle="Δείκτης μετατρεψιμότητας τροφής (κατανάλωση kg / αύξηση kg)"
        rows={fcrRows}
        cellLabels={cellLabels}
        projectStart={projectStart}
        defaultGrouping="cell"
      />

      {/* Temperatures vs Aviagen */}
      <MultiGroupChart
        title={t.stats.tempMaxDev}
        subtitle="Μέγιστη ημερήσια θερμοκρασία ανά κελί. Πράσινη ζώνη = ενδεικτικό εύρος Aviagen."
        rows={tempRows}
        cellLabels={cellLabels}
        projectStart={projectStart}
        yUnit="°C"
        band={band}
      />
    </div>
  );
}
