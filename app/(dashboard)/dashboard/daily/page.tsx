import { createServerClient } from "@/lib/supabase/server";
import DailyTemperatureForm from "@/components/DailyTemperatureForm";
import DeviationBadge from "@/components/DeviationBadge";
import DeleteButton from "@/components/DeleteButton";
import SlaughterSchedule from "@/components/SlaughterScheduleAdmin";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { breedingWeek, aviagenForWeek, tempStatus, humidStatus } from "@/lib/aviagen";
import { AviagenTarget } from "@/lib/types";

export default async function DailyPage() {
  const supabase = await createServerClient();

  const [{ data: locations }, { data: recent }, { data: targets }, { data: settings }] = await Promise.all([
    supabase.from("locations").select("*").order("position"),
    supabase
      .from("daily_temperatures")
      .select("*, locations(name)")
      .is("deleted_at", null)
      .order("recorded_on", { ascending: false })
      .limit(50),
    supabase.from("aviagen_targets").select("*").order("week_start"),
    supabase.from("app_settings").select("*").eq("id", 1).single(),
  ]);

  const projectStart = settings?.project_start_date ?? null;
  const aviagenTargets: AviagenTarget[] = targets ?? [];
  const todayWeek = projectStart ? breedingWeek(new Date(), projectStart) : 0;
  const todayTarget = aviagenForWeek(todayWeek, aviagenTargets);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{t.daily.title}</h1>
      <p className="text-gray-400 text-sm mb-6">{t.daily.subtitle}</p>

      {/* Aviagen target reference card for today */}
      {projectStart && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-6 text-sm">
          <div>
            <div className="text-xs text-gray-500">Έναρξη εκτροφής</div>
            <div className="text-white font-medium">{formatDate(projectStart)}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Τρέχουσα εβδομάδα</div>
            <div className="text-emerald-400 font-bold">
              {todayWeek <= 0 ? "—" : `Εβδομάδα ${todayWeek}`}
            </div>
          </div>
          {todayTarget && (
            <>
              <div className="border-l border-gray-800 pl-6">
                <div className="text-xs text-gray-500">{t.daily.aviagenLabel} · {t.daily.aviagenTemp}</div>
                <div className="text-white font-medium">{todayTarget.temp_min}–{todayTarget.temp_max} °C</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">{t.daily.aviagenLabel} · {t.daily.aviagenHumid}</div>
                <div className="text-white font-medium">{todayTarget.humid_min}–{todayTarget.humid_max} %</div>
              </div>
            </>
          )}
        </div>
      )}

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
                <th className="text-center px-4 py-3">Εβδ.</th>
                <th className="text-center px-4 py-3">Min</th>
                <th className="text-center px-4 py-3">Max</th>
                <th className="text-center px-4 py-3">Πρωί</th>
                <th className="text-center px-4 py-3">Μεσ.</th>
                <th className="text-center px-4 py-3">Απογ.</th>
                <th className="text-center px-4 py-3">Υγρ.%</th>
                <th className="text-center px-4 py-3">Νεκρά</th>
                <th className="text-center px-4 py-3">Άρρ.</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((r: any) => {
                const week = projectStart ? breedingWeek(r.recorded_on, projectStart) : 0;
                const target = aviagenForWeek(week, aviagenTargets);
                return (
                  <tr key={r.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-2 text-gray-300">{formatDate(r.recorded_on)}</td>
                    <td className="px-4 py-2 text-white font-medium">{r.locations?.name ?? t.common.dash}</td>
                    <td className="px-4 py-2 text-center text-gray-400">{week > 0 ? week : t.common.dash}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-gray-300">{r.temp_min ?? t.common.dash}</span>
                        {r.temp_min !== null && <DeviationBadge status={tempStatus(r.temp_min, target)} />}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-gray-300">{r.temp_max ?? t.common.dash}</span>
                        {r.temp_max !== null && <DeviationBadge status={tempStatus(r.temp_max, target)} />}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-gray-300">{r.temp_morning ?? t.common.dash}</td>
                    <td className="px-4 py-2 text-center text-gray-300">{r.temp_midday ?? t.common.dash}</td>
                    <td className="px-4 py-2 text-center text-gray-300">{r.temp_evening ?? t.common.dash}</td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className="text-gray-300">{r.humidity ?? t.common.dash}</span>
                        {r.humidity !== null && <DeviationBadge status={humidStatus(r.humidity, target)} />}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center text-red-400">{r.mortality}</td>
                    <td className="px-4 py-2 text-center text-amber-400">{r.sick_count}</td>
                    <td className="px-4 py-2 text-center">
                      <DeleteButton endpoint="/api/daily-temperatures" id={r.id} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <SlaughterSchedule />
    </div>
  );
}
