import { createServerClient } from "@/lib/supabase/server";
import WeightChart from "@/components/WeightChart";
import CullChart from "@/components/CullChart";
import { t } from "@/lib/i18n";

export default async function StatsPage() {
  const supabase = await createServerClient();

  const { data: measurements } = await supabase
    .from("measurements")
    .select("measured_at, weight_kg, location_id")
    .is("deleted_at", null)
    .order("measured_at", { ascending: true })
    .limit(1000);

  const { data: culls } = await supabase
    .from("culls")
    .select("culled_at, weight_at_cull, reason, location_id")
    .is("deleted_at", null)
    .order("culled_at", { ascending: true });

  const { data: locations } = await supabase.from("locations").select("id, name");

  // Weekly avg weight per location
  const weeklyWeightData: Record<string, any[]> = {};
  for (const m of measurements ?? []) {
    const week = m.measured_at?.slice(0, 7); // YYYY-MM
    if (!week || !m.weight_kg) continue;
    if (!weeklyWeightData[week]) weeklyWeightData[week] = [];
    weeklyWeightData[week].push(m.weight_kg);
  }
  const weightChartData = Object.entries(weeklyWeightData).map(([month, weights]) => ({
    month,
    avg: Math.round((weights.reduce((a, b) => a + b, 0) / weights.length) * 100) / 100,
  }));

  // Weekly culls
  const weekCullData: Record<string, number> = {};
  for (const c of culls ?? []) {
    const week = c.culled_at?.slice(0, 7);
    if (!week) continue;
    weekCullData[week] = (weekCullData[week] ?? 0) + 1;
  }
  const cullChartData = Object.entries(weekCullData).map(([month, count]) => ({ month, count }));

  const totalCulled = (culls ?? []).length;
  const harvestCulled = (culls ?? []).filter((c: any) => c.reason === "harvest").length;
  const avgCullWeight = (culls ?? []).filter((c: any) => c.weight_at_cull).length
    ? (culls ?? []).reduce((sum: number, c: any) => sum + (c.weight_at_cull ?? 0), 0) / (culls ?? []).filter((c: any) => c.weight_at_cull).length
    : null;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">{t.stats.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{t.stats.subtitle}</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl font-bold text-red-400">{totalCulled}</div>
          <div className="text-xs text-gray-500 mt-1">{t.stats.totalCulled}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl font-bold text-amber-400">{harvestCulled}</div>
          <div className="text-xs text-gray-500 mt-1">{t.stats.harvested}</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <div className="text-2xl font-bold text-white">
            {avgCullWeight ? `${avgCullWeight.toFixed(2)} kg` : t.common.dash}
          </div>
          <div className="text-xs text-gray-500 mt-1">{t.stats.avgCullWeight}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">{t.stats.weightOverTime}</h2>
          <WeightChart data={weightChartData} />
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-semibold text-white mb-4">{t.stats.cullsPerMonth}</h2>
          <CullChart data={cullChartData} />
        </div>
      </div>
    </div>
  );
}
