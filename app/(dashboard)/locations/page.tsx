import { createServerClient } from "@/lib/supabase/server";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { formatWeight, formatDate } from "@/lib/utils";
import { t } from "@/lib/i18n";

export default async function LocationsPage() {
  const supabase = await createServerClient();

  const { data: locations } = await supabase.from("locations").select("*").order("name");
  const { data: turkeys } = await supabase.from("turkeys").select("id, location_id, status");
  const { data: measurements } = await supabase
    .from("measurements")
    .select("location_id, weight_kg, measured_at")
    .order("measured_at", { ascending: false })
    .limit(500);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-white mb-1">{t.locations.title}</h1>
      <p className="text-gray-400 text-sm mb-8">{t.locations.subtitle}</p>

      <div className="space-y-3">
        {(locations ?? []).map((loc: any) => {
          const locTurkeys = (turkeys ?? []).filter((t: any) => t.location_id === loc.id);
          const alive = locTurkeys.filter((t: any) => t.status === "alive").length;
          const culled = locTurkeys.filter((t: any) => t.status === "culled").length;
          const locMeas = (measurements ?? []).filter((m: any) => m.location_id === loc.id);
          const lastMeas = locMeas[0];
          const avgWeight = locMeas.slice(0, 40).reduce((sum: number, m: any) => sum + (m.weight_kg ?? 0), 0) / (locMeas.slice(0, 40).filter((m: any) => m.weight_kg).length || 1);

          return (
            <Link key={loc.id} href={`/dashboard/locations/${loc.id}`}>
              <div className="flex items-center bg-gray-900 border border-gray-800 rounded-xl px-6 py-4 hover:border-emerald-600 transition-colors">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-emerald-900/30 rounded-lg text-emerald-400">
                    <MapPin size={18} />
                  </div>
                  <div>
                    <div className="font-semibold text-white">{loc.name}</div>
                    <div className="text-xs text-gray-500">{loc.description ?? t.common.dash}</div>
                  </div>
                </div>
                <div className="hidden md:flex gap-8 text-sm">
                  <div className="text-center">
                    <div className="text-emerald-400 font-bold">{alive}</div>
                    <div className="text-gray-500 text-xs">{t.overview.alive}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-red-400 font-bold">{culled}</div>
                    <div className="text-gray-500 text-xs">{t.overview.culled}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-white font-bold">{formatWeight(avgWeight || null)}</div>
                    <div className="text-gray-500 text-xs">{t.overview.avgWeight}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-300 font-bold">{formatDate(lastMeas?.measured_at ?? null)}</div>
                    <div className="text-gray-500 text-xs">{t.overview.lastRecorded}</div>
                  </div>
                </div>
                <ChevronRight size={18} className="text-gray-600 ml-6" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
