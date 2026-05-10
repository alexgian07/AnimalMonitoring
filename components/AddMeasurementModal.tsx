"use client";
import { useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { Turkey } from "@/lib/types";
import { t } from "@/lib/i18n";

export default function AddMeasurementModal({ locationId, turkeys }: { locationId: string; turkeys: Turkey[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const blank = {
    turkey_id: "",
    measured_at: new Date().toISOString().split("T")[0],
    weight_kg: "",
    temperature_celsius: "",
    metatarsus_length_mm: "",
    metatarsus_diameter_mm: "",
    chest_width_mm: "",
    keel_length_mm: "",
    body_length_mm: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);

  const num = (v: string) => v === "" ? null : parseFloat(v);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turkey_id: form.turkey_id,
        measured_at: form.measured_at,
        notes: form.notes,
        location_id: locationId,
        weight_kg:              num(form.weight_kg),
        temperature_celsius:    num(form.temperature_celsius),
        metatarsus_length_mm:   num(form.metatarsus_length_mm),
        metatarsus_diameter_mm: num(form.metatarsus_diameter_mm),
        chest_width_mm:         num(form.chest_width_mm),
        keel_length_mm:         num(form.keel_length_mm),
        body_length_mm:         num(form.body_length_mm),
      }),
    });
    setLoading(false);
    setOpen(false);
    setForm(blank);
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg transition-colors"
      >
        <ClipboardList size={14} /> {t.addMeasurement.button}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
              <h2 className="font-semibold text-white">{t.addMeasurement.title}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.turkey}</label>
                  <select required value={form.turkey_id} onChange={e => setForm(f => ({ ...f, turkey_id: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
                    <option value="">{t.addMeasurement.selectTurkey}</option>
                    {turkeys.map(turkey => (
                      <option key={turkey.id} value={turkey.id}>{turkey.tag} ({turkey.sex})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.date}</label>
                  <input required type="date" value={form.measured_at} onChange={e => setForm(f => ({ ...f, measured_at: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.weight}</label>
                  <input type="number" step="0.01" min="0" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="π.χ. 5.20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.temperature}</label>
                  <input type="number" step="0.1" value={form.temperature_celsius} onChange={e => setForm(f => ({ ...f, temperature_celsius: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="π.χ. 41.2" />
                </div>
              </div>

              {/* Body measurements section */}
              <div className="pt-3 border-t border-gray-800">
                <div className="text-xs uppercase tracking-wider text-gray-500 mb-3">{t.addMeasurement.bodySection}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.metatarsusLength}</label>
                    <input type="number" step="0.1" min="0" value={form.metatarsus_length_mm} onChange={e => setForm(f => ({ ...f, metatarsus_length_mm: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.metatarsusDiameter}</label>
                    <input type="number" step="0.1" min="0" value={form.metatarsus_diameter_mm} onChange={e => setForm(f => ({ ...f, metatarsus_diameter_mm: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.chestWidth}</label>
                    <input type="number" step="0.1" min="0" value={form.chest_width_mm} onChange={e => setForm(f => ({ ...f, chest_width_mm: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.keelLength}</label>
                    <input type="number" step="0.1" min="0" value={form.keel_length_mm} onChange={e => setForm(f => ({ ...f, keel_length_mm: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.bodyLength}</label>
                    <input type="number" step="0.1" min="0" value={form.body_length_mm} onChange={e => setForm(f => ({ ...f, body_length_mm: e.target.value }))}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.addMeasurement.notes}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {loading ? t.addMeasurement.submitting : t.addMeasurement.submit}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
