"use client";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { t } from "@/lib/i18n";

export default function AddTurkeyModal({ locationId }: { locationId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ tag: "", sex: "Unknown", birth_date: "", notes: "" });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/turkeys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, location_id: locationId }),
    });
    setLoading(false);
    setOpen(false);
    setForm({ tag: "", sex: "Unknown", birth_date: "", notes: "" });
    window.location.reload();
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
      >
        <Plus size={14} /> {t.addTurkey.button}
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="font-semibold text-white">{t.addTurkey.title}</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.addTurkey.tag}</label>
                <input required value={form.tag} onChange={e => setForm(f => ({ ...f, tag: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500"
                  placeholder={t.addTurkey.tagPlaceholder} />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.addTurkey.sex}</label>
                <select value={form.sex} onChange={e => setForm(f => ({ ...f, sex: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500">
                  <option value="Unknown">{t.turkey.unknown}</option>
                  <option value="M">{t.turkey.male}</option>
                  <option value="F">{t.turkey.female}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.addTurkey.birthDate}</label>
                <input type="date" value={form.birth_date} onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">{t.addTurkey.notes}</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500 resize-none"
                  placeholder={t.addTurkey.notesPlaceholder} />
              </div>
              <button type="submit" disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                {loading ? t.addTurkey.submitting : t.addTurkey.submit}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
