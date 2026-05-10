import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { t } from "@/lib/i18n";

export default async function BarnPage() {
  const supabase = await createServerClient();

  const [{ data: locations }, { data: turkeys }] = await Promise.all([
    supabase.from("locations").select("*").order("position"),
    supabase
      .from("turkeys")
      .select("id, tag, sex, location_id")
      .eq("status", "alive")
      .is("deleted_at", null)
      .order("tag"),
  ]);

  const turkeysByLocation: Record<string, any[]> = {};
  for (const tk of turkeys ?? []) {
    if (!turkeysByLocation[tk.location_id]) turkeysByLocation[tk.location_id] = [];
    turkeysByLocation[tk.location_id].push(tk);
  }

  const sexColor = (sex: string) =>
    sex === "M" ? "bg-blue-900/40 text-blue-300 border-blue-800/50"
    : sex === "F" ? "bg-pink-900/40 text-pink-300 border-pink-800/50"
    : "bg-gray-800 text-gray-300 border-gray-700";

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-1">{t.barn.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{t.barn.subtitle}</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(["left", "right"] as const).map(side => (
          <div key={side}>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">
              {side === "left" ? t.barn.leftSide : t.barn.rightSide}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(locations ?? []).filter((l: any) => l.side === side).map((loc: any) => {
                const cellTurkeys = turkeysByLocation[loc.id] ?? [];
                return (
                  <div
                    key={loc.id}
                    className="bg-gray-900 border border-gray-800 rounded-xl p-4 hover:border-emerald-600 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <Link href={`/dashboard/locations/${loc.id}`} className="font-semibold text-white hover:text-emerald-400 transition-colors">
                        {loc.name}
                      </Link>
                      <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full">
                        {t.barn.aliveCount(cellTurkeys.length)}
                      </span>
                    </div>
                    {cellTurkeys.length === 0 ? (
                      <div className="text-xs text-gray-600 italic py-4 text-center">{t.barn.emptyCell}</div>
                    ) : (
                      <div className="flex flex-wrap gap-1.5 min-h-[3rem]">
                        {cellTurkeys.map(tk => (
                          <Link
                            key={tk.id}
                            href={`/dashboard/turkeys/${tk.id}`}
                            className={`text-[11px] font-mono px-2 py-1 rounded-md border transition-colors hover:brightness-125 ${sexColor(tk.sex)}`}
                            title={`${tk.tag} (${tk.sex})`}
                          >
                            {tk.tag}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-gray-500">
        <span>Υπόμνημα:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-blue-900/40 border border-blue-800/50"></span> Άρρεν
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-pink-900/40 border border-pink-800/50"></span> Θήλυ
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-gray-800 border border-gray-700"></span> Άγνωστο
        </span>
      </div>
    </div>
  );
}
