"use client";
import { useState } from "react";
import { Location } from "@/lib/types";
import { t } from "@/lib/i18n";

export default function DailyTemperatureForm({ locations }: { locations: Location[] }) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    location_id: "",
    recorded_on: new Date().toISOString().split("T")[0],
    temp_min: "",
    temp_max: "",
    temp_morning: "",
    temp_midday: "",
    temp_evening: "",
    humidity: "",
    mortality: "",
    sick_count: "",
    notes: "",
  });

  const num = (v: string) => v === "" ? null : parseFloat(v);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/daily-temperatures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        location_id:  form.location_id,
        recorded_on:  form.recorded_on,
        temp_min:     num(form.temp_min),
        temp_max:     num(form.temp_max),
        temp_morning: num(form.temp_morning),
        temp_midday:  num(form.temp_midday),
        temp_evening: num(form.temp_evening),
        humidity:     form.humidity === "" ? null : parseInt(form.humidity),
        mortality:    form.mortality === "" ? 0 : parseInt(form.mortality),
        sick_count:   form.sick_count === "" ? 0 : parseInt(form.sick_count),
        notes:        form.notes,
      }),
    });
    setLoading(false);
    if (res.ok) {
      window.location.reload();
    } else {
      const err = await res.json();
      alert(err.error ?? "Σφάλμα");
    }
  }

  const inputClass = "w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500";

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
      <h2 className="font-semibold text-white">{t.daily.formTitle}</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.cell}</label>
          <select required value={form.location_id} onChange={e => setForm(f => ({ ...f, location_id: e.target.value }))} className={inputClass}>
            <option value="">{t.daily.selectCell}</option>
            {locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.date}</label>
          <input required type="date" value={form.recorded_on} onChange={e => setForm(f => ({ ...f, recorded_on: e.target.value }))} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.tempMin}</label>
          <input type="number" step="0.1" value={form.temp_min} onChange={e => setForm(f => ({ ...f, temp_min: e.target.value }))} className={inputClass} placeholder="π.χ. 21.5" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.tempMax}</label>
          <input type="number" step="0.1" value={form.temp_max} onChange={e => setForm(f => ({ ...f, temp_max: e.target.value }))} className={inputClass} placeholder="π.χ. 26.0" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.tempMorning}</label>
          <input type="number" step="0.1" value={form.temp_morning} onChange={e => setForm(f => ({ ...f, temp_morning: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.tempMidday}</label>
          <input type="number" step="0.1" value={form.temp_midday} onChange={e => setForm(f => ({ ...f, temp_midday: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.tempEvening}</label>
          <input type="number" step="0.1" value={form.temp_evening} onChange={e => setForm(f => ({ ...f, temp_evening: e.target.value }))} className={inputClass} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.humidity}</label>
          <input type="number" min="0" max="100" value={form.humidity} onChange={e => setForm(f => ({ ...f, humidity: e.target.value }))} className={inputClass} placeholder="0-100" />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.mortality}</label>
          <input type="number" min="0" value={form.mortality} onChange={e => setForm(f => ({ ...f, mortality: e.target.value }))} className={inputClass} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.daily.sickCount}</label>
          <input type="number" min="0" value={form.sick_count} onChange={e => setForm(f => ({ ...f, sick_count: e.target.value }))} className={inputClass} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-gray-400 mb-1">{t.daily.notes}</label>
        <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} className={`${inputClass} resize-none`} />
      </div>

      <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
        {loading ? t.daily.submitting : t.daily.submit}
      </button>
    </form>
  );
}
