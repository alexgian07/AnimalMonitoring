import { createServerClient } from "@/lib/supabase/server";
import FeedLogForm from "@/components/FeedLogForm";
import DeleteButton from "@/components/DeleteButton";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export default async function FeedPage() {
  const supabase = await createServerClient();

  const [{ data: locations }, { data: logs }, { data: settings }] = await Promise.all([
    supabase.from("locations").select("*").order("position"),
    supabase
      .from("feed_logs")
      .select("*, locations(name, position)")
      .is("deleted_at", null)
      .order("week_number", { ascending: true })
      .limit(500),
    supabase.from("app_settings").select("project_start_date").eq("id", 1).single(),
  ]);

  // Group logs by location for display
  const logsByLocation: Record<string, any[]> = {};
  for (const l of logs ?? []) {
    if (!logsByLocation[l.location_id]) logsByLocation[l.location_id] = [];
    logsByLocation[l.location_id].push(l);
  }

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{t.feed.title}</h1>
      <p className="text-gray-400 text-sm mb-6">{t.feed.subtitle}</p>

      <FeedLogForm locations={locations ?? []} projectStartDate={settings?.project_start_date ?? null} />

      <h2 className="text-lg font-semibold text-white mt-10 mb-3">{t.feed.historyTitle}</h2>

      {(logs ?? []).length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-xl text-center py-12 text-gray-500">
          {t.feed.noLogs}
        </div>
      ) : (
        <div className="space-y-6">
          {(locations ?? []).map((loc: any) => {
            const locLogs = logsByLocation[loc.id] ?? [];
            if (!locLogs.length) return null;
            return (
              <div key={loc.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-800 flex items-center justify-between">
                  <h3 className="font-semibold text-white">{loc.name}</h3>
                  <span className="text-xs text-gray-500">{locLogs.length} εβδομάδες καταγεγραμμένες</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                        <th className="text-center px-3 py-3">Εβδ.</th>
                        <th className="text-left px-3 py-3">Ημ/νία</th>
                        <th className="text-left px-3 py-3">Ταΐστρα</th>
                        <th className="text-center px-3 py-3">Πριν</th>
                        <th className="text-center px-3 py-3">+ Τροφή</th>
                        <th className="text-center px-3 py-3">Μετά</th>
                        <th className="text-center px-3 py-3">{t.feed.consumption}</th>
                        <th className="text-center px-3 py-3">Ζώα</th>
                        <th className="text-center px-3 py-3">Μ.Ο. Β.</th>
                        <th className="text-center px-3 py-3">Σύν. Β.</th>
                        <th className="text-center px-3 py-3">{t.feed.fcrWeekly}</th>
                        <th className="px-3 py-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {locLogs.map((l: any) => {
                        const fcr = l.consumption_kg && l.weight_gain_kg && l.weight_gain_kg > 0
                          ? (l.consumption_kg / l.weight_gain_kg).toFixed(2)
                          : t.common.dash;
                        return (
                          <tr key={l.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                            <td className="px-3 py-2 text-center text-emerald-400 font-medium">{l.week_number}</td>
                            <td className="px-3 py-2 text-gray-300">{formatDate(l.week_start_date)}</td>
                            <td className="px-3 py-2 text-gray-400 text-xs">
                              {l.feeder_label === "main" ? t.feed.feederMain : t.feed.feederExtra}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-300">{l.weight_before_kg ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{l.feed_added_kg ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{l.weight_after_kg ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-amber-400 font-medium">{l.consumption_kg ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{l.bird_count ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{l.avg_weight_kg ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-gray-300">{l.total_flock_kg ?? t.common.dash}</td>
                            <td className="px-3 py-2 text-center text-emerald-400 font-medium">{fcr}</td>
                            <td className="px-3 py-2 text-center">
                              <DeleteButton endpoint="/api/feed-logs" id={l.id} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
