"use client";
import { useState } from "react";
import { Location } from "@/lib/types";
import { t } from "@/lib/i18n";

export default function FeedLogForm({ locations, projectStartDate }: { locations: Location[]; projectStartDate: string | null }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    location_id: "",
    feeder_label: "main",
    week_number: "1",
    week_start_date: monday(new Date()).toISOString().split("T")[0],
    weight_before_kg: "",
    feed_added_kg: "",
    weight_after_kg: "",
    bird_count: "",
    avg_weight_kg: "",
    weight_gain_kg: "",
    notes: "",
  });

  function monday(d: Date) {
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1) - day; // shift back to monday
    const m = new Date(d);
    m.setDate(d.getDate() + diff);
    return m;
  }

  // Auto-suggest week_start_date when week_number changes (if project start known)
  function setWeek(n: string) {
    setForm(f => {
      const next = { ...f, week_number: n };
      if (projectStartDate && n) {
        const start = new Date(projectStartDate);
        const offsetDays = (parseInt(n) - 1) * 7;
        start.setDate(start.getDate() + offsetDays);
        next.week_start_date = monday(start).toISOString().split("T")[0];
      }
      return next;
    });
  }

  const num = (v: string) => v === "" ? null : parseFloat(v);
  const int = (v: string) => v === "" ? null : parseInt(v);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/feed-logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id:      form.location_id,
        feeder_label:     form.feeder_label,
        week_number:      parseInt(form.week_number),
        week_start_date:  form.week_start_date,
        weight_before_kg: num(form.weight_before_kg),
        feed_added_kg:    num(form.feed_added_kg),
        weight_after_kg:  num(form.weight_after_kg),
        bird_count:       int(form.bird_count),
        avg_weight_kg:    num(form.avg_weight_kg),
        weight_gain_kg:   num(form.weight_gain_kg),
        notes:            form.notes,
      }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Σφάλμα");
    }
  }

  // Live preview of consumption (DB also computes it via GENERATED column)
  const previewConsumption =
    form.weight_before_kg && form.feed_added_kg && form.weight_after_kg
      ? (parseFloat(form.weight_before_kg) + parseFloat(form.feed_added_kg) - parseFloat(form.weight_after_kg)).toFixed(2)
      : null;

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500";

  const week = parseInt(form.week_number || "0");
  const showExtraOption = week >= 1 && week <= 2;

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-white">{t.feed.formTitle}</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.cell}</label>
          <select required value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} className={inputClass}>
            <option value="">{t.feed.selectCell}</option>
            {locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.weekNumber}</label>
          <input required type="number" min="1" max="28" value={form.week_number} onChange={e => setWeek(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.weekStartDate}</label>
          <input required type="date" value={form.week_start_date} onChange={e => setForm(f => ({ ...f, week_start_date: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {showExtraOption && (
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.feeder}</label>
          <div className="flex gap-2">
            {(["main", "extra"] as const).map(label => (
              <button
                key={label}
                type="button"
                onClick={() => setForm(f => ({ ...f, feeder_label: label }))}
                className={`px-3 py-1.5 rounded-lg border text-sm transition-colors ${
                  form.feeder_label === label
                    ? "bg-emerald-700 border-emerald-600 text-white"
                    : "border-gray-700 text-gray-400 hover:border-gray-500"
                }`}
              >
                {label === "main" ? t.feed.feederMain : t.feed.feederExtra}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.weightBefore}</label>
          <input type="number" step="0.01" min="0" value={form.weight_before_kg} onChange={e => setForm(f => ({ ...f, weight_before_kg: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.feedAdded}</label>
          <input type="number" step="0.01" min="0" value={form.feed_added_kg} onChange={e => setForm(f => ({ ...f, feed_added_kg: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.weightAfter}</label>
          <input type="number" step="0.01" min="0" value={form.weight_after_kg} onChange={e => setForm(f => ({ ...f, weight_after_kg: e.target.value }))} className={inputClass} />
        </div>
      </div>

      {previewConsumption && (
        <div className="text-xs text-emerald-400">
          → {t.feed.consumption}: <strong>{previewConsumption} kg</strong>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-800">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.birdCount}</label>
          <input type="number" min="0" value={form.bird_count} onChange={e => setForm(f => ({ ...f, bird_count: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.avgWeight}</label>
          <input type="number" step="0.01" min="0" value={form.avg_weight_kg} onChange={e => setForm(f => ({ ...f, avg_weight_kg: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.feed.weightGain}</label>
          <input type="number" step="0.01" min="0" value={form.weight_gain_kg} onChange={e => setForm(f => ({ ...f, weight_gain_kg: e.target.value }))} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t.feed.notes}</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
      </div>

      <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
        {loading ? t.feed.submitting : t.feed.submit}
      </button>
    </form>
  );
}
