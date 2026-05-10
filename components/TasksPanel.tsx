import { createServerClient } from "@/lib/supabase/server";
import { Calendar, Sun, Sunrise, Scissors, CalendarRange } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

// JS Date.getDay(): 0=Sun, 1=Mon..6=Sat
// Our tasks_template.day_of_week: 1=Mon..7=Sun
function jsDayToOurDay(jsDay: number) {
  return jsDay === 0 ? 7 : jsDay;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  target.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function TasksPanel() {
  const supabase = await createServerClient();

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const todayDow    = jsDayToOurDay(today.getDay());
  const tomorrowDow = jsDayToOurDay(tomorrow.getDay());

  const todayName    = t.tasks.weekdays[todayDow - 1];
  const tomorrowName = t.tasks.weekdays[tomorrowDow - 1];

  const [{ data: todayTasks }, { data: tomorrowTasks }, { data: slaughters }] = await Promise.all([
    supabase
      .from("tasks_template")
      .select("*")
      .eq("day_of_week", todayDow)
      .order("position"),
    supabase
      .from("tasks_template")
      .select("*")
      .eq("day_of_week", tomorrowDow)
      .order("position"),
    supabase
      .from("slaughter_schedule")
      .select("*")
      .gte("scheduled_on", today.toISOString().split("T")[0])
      .order("scheduled_on")
      .limit(3),
  ]);

  const nextSlaughter = (slaughters ?? [])[0];
  const nextSlaughterDays = nextSlaughter ? daysUntil(nextSlaughter.scheduled_on) : null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
      {/* Today */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-emerald-900/40 rounded-lg text-emerald-400">
            <Sun size={16} />
          </div>
          <div>
            <div className="text-xs text-gray-500">{t.tasks.today}</div>
            <div className="text-sm font-semibold text-white">{todayName}</div>
          </div>
        </div>
        <ul className="space-y-1.5 text-xs text-gray-300">
          {(todayTasks ?? []).length === 0 ? (
            <li className="text-gray-500">{t.tasks.noTasksToday}</li>
          ) : (
            (todayTasks ?? []).map((tk: any) => (
              <li key={tk.id} className="flex items-start gap-2">
                <span className="text-gray-500 font-mono text-[10px] mt-0.5">{tk.time_slot ?? ""}</span>
                <span>{tk.task_label}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Tomorrow */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-blue-900/40 rounded-lg text-blue-400">
            <Sunrise size={16} />
          </div>
          <div>
            <div className="text-xs text-gray-500">{t.tasks.tomorrow}</div>
            <div className="text-sm font-semibold text-white">{tomorrowName}</div>
          </div>
        </div>
        <ul className="space-y-1.5 text-xs text-gray-300">
          {(tomorrowTasks ?? []).length === 0 ? (
            <li className="text-gray-500">{t.tasks.noTasksToday}</li>
          ) : (
            (tomorrowTasks ?? []).map((tk: any) => (
              <li key={tk.id} className="flex items-start gap-2">
                <span className="text-gray-500 font-mono text-[10px] mt-0.5">{tk.time_slot ?? ""}</span>
                <span>{tk.task_label}</span>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Next slaughter */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="p-1.5 bg-red-900/40 rounded-lg text-red-400">
            <Scissors size={16} />
          </div>
          <div>
            <div className="text-xs text-gray-500">{t.tasks.nextSlaughter}</div>
            {nextSlaughter ? (
              <>
                <div className="text-sm font-semibold text-white">{formatDate(nextSlaughter.scheduled_on)}</div>
                <div className="text-xs text-red-400 mt-0.5">
                  {nextSlaughterDays !== null && t.tasks.daysAway(nextSlaughterDays)}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-500">{t.tasks.noUpcomingSlaughter}</div>
            )}
          </div>
        </div>
        {nextSlaughter?.notes && (
          <p className="text-xs text-gray-400 mt-2 italic">{nextSlaughter.notes}</p>
        )}
        {(slaughters ?? []).length > 1 && (
          <div className="mt-3 pt-3 border-t border-gray-800 space-y-1 text-xs">
            <div className="text-gray-500 mb-1">Επόμενες:</div>
            {(slaughters ?? []).slice(1).map((s: any) => (
              <div key={s.id} className="text-gray-400">
                {formatDate(s.scheduled_on)} <span className="text-gray-600">({t.tasks.daysAway(daysUntil(s.scheduled_on))})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
