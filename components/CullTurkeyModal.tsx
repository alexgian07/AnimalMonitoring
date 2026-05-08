"use client";
import { useState } from "react";
import { Scissors, X } from "lucide-react";
import { Turkey } from "@/lib/types";

export default function CullTurkeyModal({ turkey }: { turkey: Turkey }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    culled_at: new Date().toISOString().split("T")[0],
    weight_at_cull: "",
    reason: "harvest",
    notes: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/culls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        turkey_id: turkey.id,
        location_id: turkey.location_id,
        ...form,
        weight_at_cull: form.weight_at_cull ? parseFloat(form.weight_at_cull) : null,
      }),
    });
    setLoading(false);
    setOpen(false);
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
      >
        <Scissors size={12} /> Cull
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="font-semibold text-white">Cull Turkey <span className="text-red-400">{turkey.tag}</span></h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Date *</label>
                <input required type="date" value={form.culled_at} onChange={e => setForm(f => ({ ...f, culled_at: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Weight at Cull (kg)</label>
                <input type="number" step="0.01" min="0" value={form.weight_at_cull} onChange={e => setForm(f => ({ ...f, weight_at_cull: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500"
                  placeholder="e.g. 8.50" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Reason</label>
                <select value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500">
                  <option value="harvest">Harvest</option>
                  <option value="illness">Illness</option>
                  <option value="injury">Injury</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-red-500 resize-none" />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-red-700 hover:bg-red-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {loading ? "Recording..." : "Confirm Cull"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
