import { createServerClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { formatDate, formatWeight, formatTemp } from "@/lib/utils";
import TimeSeriesChart from "@/components/charts/TimeSeriesChart";
import DeleteButton from "@/components/DeleteButton";
import { t } from "@/lib/i18n";

export default async function TurkeyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();

  const { data: turkey } = await supabase
    .from("turkeys")
    .select("*, locations(name)")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (!turkey) notFound();

  const { data: measurements } = await supabase
    .from("measurements")
    .select("*")
    .eq("turkey_id", id)
    .is("deleted_at", null)
    .order("measured_at");

  const { data: culls } = await supabase
    .from("culls")
    .select("*")
    .eq("turkey_id", id)
    .is("deleted_at", null);

  // Build chart data: each row = one measurement date, multiple series
  const chartData = (measurements ?? []).map((m: any) => ({
    label: formatDate(m.measured_at),
    Βάρος:    m.weight_kg,
    "Μετ. μήκος":   m.metatarsus_length_mm,
    "Μετ. διάμ.":   m.metatarsus_diameter_mm,
    Στήθος:   m.chest_width_mm,
    Τρόπιδα:  m.keel_length_mm,
    Σώμα:     m.body_length_mm,
  }));

  const sexLabel = turkey.sex === "M" ? t.turkey.male : turkey.sex === "F" ? t.turkey.female : t.turkey.unknown;
  const statusLabel = turkey.status === "alive" ? t.turkey.statusAlive : turkey.status === "culled" ? t.turkey.statusCulled : t.turkey.statusDead;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <Link href={`/dashboard/locations/${turkey.location_id}`} className="flex items-center gap-1 text-gray-400 hover:text-white text-sm mb-6">
        <ArrowLeft size={14} /> Πίσω στο {turkey.locations?.name ?? "Κελί"}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white font-mono">{turkey.tag}</h1>
          <p className="text-gray-400 text-sm">
            {turkey.locations?.name ?? t.common.dash} · {sexLabel} · {statusLabel}
            {turkey.birth_date && <> · γέννηση {formatDate(turkey.birth_date)}</>}
          </p>
          {turkey.notes && <p className="text-xs text-gray-500 italic mt-1">{turkey.notes}</p>}
        </div>
      </div>

      {/* Body measurements over time */}
      {chartData.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-8">
          <h2 className="font-semibold text-white mb-4">Εξέλιξη μετρήσεων</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <div className="text-xs text-gray-500 mb-2">Βάρος (kg)</div>
              <TimeSeriesChart
                data={chartData}
                series={[{ key: "Βάρος", name: "Βάρος" }]}
                yUnit="kg"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-2">Σωματομετρήσεις (mm)</div>
              <TimeSeriesChart
                data={chartData}
                series={[
                  { key: "Μετ. μήκος", name: "Μετ. μήκος" },
                  { key: "Μετ. διάμ.", name: "Μετ. διάμ." },
                  { key: "Στήθος",     name: "Στήθος" },
                  { key: "Τρόπιδα",    name: "Τρόπιδα" },
                  { key: "Σώμα",       name: "Σώμα" },
                ]}
                yUnit="mm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Measurement history table */}
      <h2 className="text-lg font-semibold text-white mb-3">Ιστορικό Μετρήσεων</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-x-auto mb-8">
        {(measurements ?? []).length === 0 ? (
          <div className="text-center py-12 text-gray-500">Χωρίς μετρήσεις ακόμα</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
                <th className="text-left px-4 py-3">Ημ/νία</th>
                <th className="text-center px-4 py-3">Βάρος</th>
                <th className="text-center px-4 py-3">Θερμ.</th>
                <th className="text-center px-4 py-3">Μετ.Μ.</th>
                <th className="text-center px-4 py-3">Μετ.Δ.</th>
                <th className="text-center px-4 py-3">Στήθος</th>
                <th className="text-center px-4 py-3">Τρόπιδα</th>
                <th className="text-center px-4 py-3">Σώμα</th>
                <th className="text-left px-4 py-3">Σημ.</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {(measurements ?? []).map((m: any) => (
                <tr key={m.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2 text-gray-300">{formatDate(m.measured_at)}</td>
                  <td className="px-4 py-2 text-center text-white">{formatWeight(m.weight_kg)}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{formatTemp(m.temperature_celsius)}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.metatarsus_length_mm ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.metatarsus_diameter_mm ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.chest_width_mm ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.keel_length_mm ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-center text-gray-300">{m.body_length_mm ?? t.common.dash}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs italic">{m.notes ?? ""}</td>
                  <td className="px-4 py-2 text-center"><DeleteButton endpoint="/api/measurements" id={m.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cull info if any */}
      {(culls ?? []).length > 0 && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-red-400 mb-2">Καταγραφή Σφαγής</h3>
          {(culls ?? []).map((c: any) => (
            <div key={c.id} className="text-sm text-gray-300">
              <strong>{formatDate(c.culled_at)}</strong> · {c.reason} · βάρος: {formatWeight(c.weight_at_cull)}
              {c.notes && <p className="text-xs text-gray-500 italic mt-1">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
