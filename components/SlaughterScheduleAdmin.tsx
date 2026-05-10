"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { t } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";

interface Slaughter {
  id: string;
  scheduled_on: string;
  notes: string | null;
}

export default function SlaughterScheduleAdmin() {
  const [list, setList] = useState<Slaughter[]>([]);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  async function refresh() {
    const r = await fetch("/api/slaughter-dates");
    if (r.ok) setList(await r.json());
  }

  useEffect(() => { refresh(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date) return;
    setLoading(true);
    const r = await fetch("/api/slaughter-dates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduled_on: date, notes }),
    });
    setLoading(false);
    if (r.ok) {
      setDate("");
      setNotes("");
      refresh();
    } else {
      const err = await r.json().catch(() => ({}));
      alert(err.error ?? "Σφάλμα");
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Διαγραφή αυτής της ημερομηνίας;")) return;
    const r = await fetch(`/api/slaughter-dates?id=${id}`, { method: "DELETE" });
    if (r.ok) refresh();
  }

  const inputClass = "bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-emerald-500";

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
      <h2 className="font-semibold text-white mb-1">{t.slaughter.title}</h2>
      <p className="text-gray-500 text-xs mb-4">{t.slaughter.subtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end mb-5">
        <div>
          <label className="block text-xs text-gray-400 mb-1">{t.slaughter.date}</label>
          <input required type="date" value={date} onChange={e => setDate(e.target.value)} className={inputClass} />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-gray-400 mb-1">{t.slaughter.notes}</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)} className={`${inputClass} w-full`} />
        </div>
        <button type="submit" disabled={loading}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <Plus size={14} /> {loading ? t.slaughter.submitting : t.slaughter.addDate}
        </button>
      </form>

      {list.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">{t.slaughter.noEntries}</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500 text-xs uppercase">
              <th className="text-left py-2">Ημερομηνία</th>
              <th className="text-left py-2">Σημειώσεις</th>
              <th className="py-2"></th>
            </tr>
          </thead>
          <tbody>
            {list.map(s => (
              <tr key={s.id} className="border-b border-gray-800/50">
                <td className="py-2 text-gray-300">{formatDate(s.scheduled_on)}</td>
                <td className="py-2 text-gray-400">{s.notes ?? t.common.dash}</td>
                <td className="py-2 text-right">
                  <button onClick={() => handleDelete(s.id)} className="text-gray-500 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
