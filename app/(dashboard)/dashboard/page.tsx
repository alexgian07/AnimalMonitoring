import { createServerClient } from "@/lib/supabase/server";
import { LocationWithStats } from "@/lib/types";
import Link from "next/link";
import { MapPin, Bird, Scissors, TrendingUp } from "lucide-react";
import { formatWeight, formatDate } from "@/lib/utils";
import { t } from "@/lib/i18n";
import TasksPanel from "@/components/TasksPanel";

export default async function DashboardPage() {
  const supabase = await createServerClient();

  const { data: locations } = await supabase.from("locations").select("*").order("position");

  const { data: aliveCounts } = await supabase
    .from("turkeys")
    .select("location_id, count:id.count()")
    .eq("status", "alive");

  const { data: cullCounts } = await supabase
    .from("turkeys")
    .select("location_id, count:id.count()")
    .eq("status", "culled");

  const { data: recentMeasurements } = await supabase
    .from("measurements")
    .select("location_id, weight_kg, measured_at")
    .is("deleted_at", null)
    .order("measured_at", { ascending: false })
    .limit(200);

  const aliveMap = Object.fromEntries((aliveCounts ?? []).map((r: any) => [r.location_id, r.count]));
  const cullMap = Object.fromEntries((cullCounts ?? []).map((r: any) => [r.location_id, r.count]));

  const avgWeightMap: Record<string, number | null> = {};
  const lastMeasMap: Record<string, string | null> = {};
  for (const m of recentMeasurements ?? []) {
    if (!lastMeasMap[m.location_id]) lastMeasMap[m.location_id] = m.measured_at;
  }
  for (const loc of locations ?? []) {
    const weights = (recentMeasurements ?? [])
      .filter((m: any) => m.location_id === loc.id && m.weight_kg)
      .slice(0, 40)
      .map((m: any) => m.weight_kg as number);
    avgWeightMap[loc.id] = weights.length ? weights.reduce((a, b) => a + b, 0) / weights.length : null;
  }

  const totalAlive: number = Object.values(aliveMap).reduce<number>((a, b) => a + Number(b), 0);
  const totalCulled: number = Object.values(cullMap).reduce<number>((a, b) => a + Number(b), 0);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">{t.overview.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{t.overview.subtitle}</p>

      {/* Tasks panel — today / tomorrow / next slaughter */}
      <TasksPanel />

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard icon={<MapPin size={20} />} label={t.overview.activePens} value={(locations ?? []).length} color="blue" />
        <StatCard icon={<Bird size={20} />} label={t.overview.aliveTurkeys} value={totalAlive} color="emerald" />
        <StatCard icon={<Scissors size={20} />} label={t.overview.culledTotal} value={totalCulled} color="red" />
        <StatCard icon={<TrendingUp size={20} />} label={t.overview.pensMonitored} value={(locations ?? []).length} color="amber" />
      </div>

      {/* Location grid: pens 1-4 left, 5-8 right */}
      <h2 className="text-lg font-semibold text-white mb-4">{t.overview.penStatus}</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(["left", "right"] as const).map(side => (
          <div key={side}>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-2">
              {side === "left" ? "Αριστερά (Κελιά 1–4)" : "Δεξιά (Κελιά 5–8)"}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(locations ?? []).filter((l: any) => l.side === side).map((loc: any) => (
                <Link key={loc.id} href={`/dashboard/locations/${loc.id}`}>
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-emerald-600 transition-colors cursor-pointer h-full">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-white">{loc.name}</span>
                      <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">
                        {aliveMap[loc.id] ?? 0} {t.overview.alive}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-gray-500">{t.overview.culled}</div>
                        <div className="text-red-400 font-medium">{cullMap[loc.id] ?? 0}</div>
                      </div>
                      <div>
                        <div className="text-gray-500">{t.overview.avgWeight}</div>
                        <div className="text-white font-medium">{formatWeight(avgWeightMap[loc.id] ?? null)}</div>
                      </div>
                      <div className="col-span-2">
                        <div className="text-gray-500">{t.overview.lastRecorded}</div>
                        <div className="text-gray-300">{formatDate(lastMeasMap[loc.id] ?? null)}</div>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: "text-blue-400 bg-blue-900/30",
    emerald: "text-emerald-400 bg-emerald-900/30",
    red: "text-red-400 bg-red-900/30",
    amber: "text-amber-400 bg-amber-900/30",
  };
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div className={`inline-flex p-2 rounded-lg mb-3 ${colors[color]}`}>{icon}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}
