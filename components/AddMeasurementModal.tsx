"use client";
import { useState } from "react";
import { ClipboardList, X } from "lucide-react";
import { Turkey } from "@/lib/types";

export default function AddMeasurementModal({ locationId, turkeys }: { locationId: string; turkeys: Turkey[] }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    turkey_id: "",
    measured_at: new Date().toISOString().split("T")[0],
    weight_kg: "",
    temperature_celsius: "",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/measurements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        location_id: locationId,
        weight_kg: form.weight_kg ? parseFloat(form.weight_kg) : null,
        temperature_celsius: form.temperature_celsius ? parseFloat(form.temperature_celsius) : null,
      }),
    });
    setLoading(false);
    setOpen(false);
    setForm({ turkey_id: "", measured_at: new Date().toISOString().split("T")[0], weight_kg: "", temperature_celsius: "", notes: "" });
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg transition-colors"
      >
        <ClipboardList size={14} /> Record Measurement
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="font-semibold text-white">Record Measurement</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Turkey *</label>
                <select required value={form.turkey_id} onChange={e => setForm(f => ({ ...f, turkey_id: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
                  <option value="">Select turkey...</option>
                  {turkeys.map(t => (
                    <option key={t.id} value={t.id}>{t.tag} ({t.sex})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date *</label>
                <input required type="date" value={form.measured_at} onChange={e => setForm(f => ({ ...f, measured_at: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Weight (kg)</label>
                  <input type="number" step="0.01" min="0" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 5.20" />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Temperature (°C)</label>
                  <input type="number" step="0.1" value={form.temperature_celsius} onChange={e => setForm(f => ({ ...f, temperature_celsius: e.target.value }))}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                    placeholder="e.g. 41.2" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {loading ? "Saving..." : "Save Measurement"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
