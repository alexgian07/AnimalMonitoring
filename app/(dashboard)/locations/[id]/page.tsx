import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatWeight, formatTemp, formatDate } from "@/lib/utils";
import AddMeasurementModal from "@/components/AddMeasurementModal";
import CullTurkeyModal from "@/components/CullTurkeyModal";
import AddTurkeyModal from "@/components/AddTurkeyModal";

export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: location } = await supabase.from("locations").select("*").eq("id", id).single();
  if (!location) notFound();

  const { data: turkeys } = await supabase
    .from("turkeys")
    .select("*")
    .eq("location_id", id)
    .order("tag");

  const turkeyIds = (turkeys ?? []).map((t: any) => t.id);

  const { data: latestMeasurements } = turkeyIds.length
    ? await supabase
        .from("measurements")
        .select("turkey_id, weight_kg, temperature_celsius, measured_at")
        .in("turkey_id", turkeyIds)
        .order("measured_at", { ascending: false })
        .limit(turkeyIds.length * 5)
    : { data: [] };

  const latestByTurkey: Record<string, any> = {};
  for (const m of latestMeasurements ?? []) {
    if (!latestByTurkey[m.turkey_id]) latestByTurkey[m.turkey_id] = m;
  }

  const alive = (turkeys ?? []).filter((t: any) => t.status === "alive");
  const culled = (turkeys ?? []).filter((t: any) => t.status === "culled");

  return (
    <div className="p-8">
      <Link href="/dashboard/locations" className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6">
        <ArrowLeft size={14} /> Back to Locations
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">{location.name}</h1>
          <p className="text-gray-400 text-sm">{location.description ?? "No description"}</p>
        </div>
        <div className="flex gap-2">
          <AddTurkeyModal locationId={id} />
          <AddMeasurementModal locationId={id} turkeys={alive} />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">{alive.length}</div>
          <div className="text-xs text-gray-500 mt-1">Alive</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{culled.length}</div>
          <div className="text-xs text-gray-500 mt-1">Culled</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-white">
            {formatWeight(
              alive.length
                ? alive.reduce((sum: number, t: any) => sum + (latestByTurkey[t.id]?.weight_kg ?? 0), 0) / alive.filter((t: any) => latestByTurkey[t.id]?.weight_kg).length || null
                : null
            )}
          </div>
          <div className="text-xs text-gray-500 mt-1">Avg Weight</div>
        </div>
      </div>

      {/* Turkey table */}
      <h2 className="text-lg font-semibold text-white mb-3">Turkeys ({alive.length} alive)</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left px-4 py-3">Tag</th>
              <th className="text-left px-4 py-3">Sex</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Last Weight</th>
              <th className="text-left px-4 py-3">Last Temp</th>
              <th className="text-left px-4 py-3">Last Recorded</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(turkeys ?? []).map((turkey: any) => {
              const m = latestByTurkey[turkey.id];
              return (
                <tr key={turkey.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-3 font-mono text-white font-medium">{turkey.tag}</td>
                  <td className="px-4 py-3 text-gray-300">{turkey.sex}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      turkey.status === "alive" ? "bg-emerald-900/50 text-emerald-400"
                      : turkey.status === "culled" ? "bg-red-900/50 text-red-400"
                      : "bg-gray-800 text-gray-400"
                    }`}>
                      {turkey.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300">{formatWeight(m?.weight_kg ?? null)}</td>
                  <td className="px-4 py-3 text-gray-300">{formatTemp(m?.temperature_celsius ?? null)}</td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(m?.measured_at ?? null)}</td>
                  <td className="px-4 py-3">
                    {turkey.status === "alive" && (
                      <CullTurkeyModal turkey={turkey} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(turkeys ?? []).length === 0 && (
          <div className="text-center py-12 text-gray-500">No turkeys added yet</div>
        )}
      </div>
    </div>
  );
}
