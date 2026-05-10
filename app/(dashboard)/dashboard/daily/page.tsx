import { createServerClient } from "@/lib/supabase/server";
import DailyTemperatureForm from "@/components/DailyTemperatureForm";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

export default async function DailyPage() {
  const supabase = await createServerClient();

  const [{ data: locations }, { data: recent }] = await Promise.all([
    supabase.from("locations").select("*").order("position"),
    supabase
      .from("daily_temperatures")
      .select("*, locations(name)")
      .order("recorded_on", { ascending: false })
      .limit(50),
  ]);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{t.daily.title}</h1>
      <p className="text-gray-400 text-sm mb-6">{t.daily.subtitle}</p>

      <DailyTemperatureForm locations={locations ?? []} />

      <h2 className="text-lg font-semibold text-white mt-10 mb-3">{t.daily.recentTitle}</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto">
        {(recent ?? []).length === 0 ? (
          <div className="text-center py-12 text-gray-500">{t.daily.noRecords}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Ημ/νία</th>
                <th className="text-left px-4 py-3">Κελί</th>
                <th className="text-center px-4 py-3">Min</th>
                <th className="text-center px-4 py-3">Max</th>
                <th className="text-center px-4 py-3">Πρωί</th>
                <th className="text-center px-4 py-3">Μεσ.</th>
                <th className="text-center px-4 py-3">Απογ.</th>
                <th className="text-center px-4 py-3">Υγρ.%</th>
                <th className="text-center px-4 py-3">Νεκρά</th>
                <th className="text-center px-4 py-3">Άρρ.</th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((r: any) => (
                <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-gray-300">{formatDate(r.recorded_on)}</td>
                  <td className="px-4 py-2 text-white font-medium">{r.locations?.name ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{r.temp_min ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{r.temp_max ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{r.temp_morning ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{r.temp_midday ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{r.temp_evening ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{r.humidity ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-red-400">{r.mortality}</td>
                  <td className="px-4 py-2 text-center text-amber-400">{r.sick_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
