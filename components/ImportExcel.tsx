"use client";
import { useState } from "react";
import { Upload } from "lucide-react";
import { t } from "@/lib/i18n";

interface ImportSummary {
  measurements:        { inserted: number; skipped: number };
  daily_temperatures:  { inserted: number; skipped: number };
  feed_logs:           { inserted: number; skipped: number };
  errors: string[];
}

export default function ImportExcel() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setSummary(null);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/import", { method: "POST", body: fd });
    setBusy(false);
    if (res.ok) {
      const data = await res.json();
      setSummary(data);
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Σφάλμα κατά το ανέβασμα");
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mt-8">
      <h2 className="font-semibold text-white mb-1">{t.excel.importTitle}</h2>
      <p className="text-gray-500 text-xs mb-4">{t.excel.importSubtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-wrap gap-3 items-end">
        <label className="text-xs text-gray-400 cursor-pointer">
          <span className="block mb-1">{t.excel.chooseFile}</span>
          <input
            type="file"
            accept=".xlsx"
            onChange={e => setFile(e.target.files?.[0] ?? null)}
            className="block text-sm text-gray-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-gray-800 file:text-white file:cursor-pointer hover:file:bg-gray-700"
          />
        </label>
        <button
          type="submit"
          disabled={!file || busy}
          className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-3 py-2 rounded-lg text-sm transition-colors"
        >
          <Upload size={14} />
          {busy ? t.excel.uploading : t.excel.upload}
        </button>
      </form>

      {summary && (
        <div className="mt-5 bg-gray-800 border border-gray-700 rounded-lg p-4 text-sm">
          <h3 className="font-semibold text-white mb-2">{t.excel.summaryTitle}</h3>
          <ul className="space-y-1 text-gray-300">
            <li>📏 Μετρήσεις: <span className="text-emerald-400">{summary.measurements.inserted}</span> {t.excel.inserted}, <span className="text-amber-400">{summary.measurements.skipped}</span> {t.excel.skipped}</li>
            <li>🌡️ Ημερήσιες: <span className="text-emerald-400">{summary.daily_temperatures.inserted}</span> {t.excel.inserted}, <span className="text-amber-400">{summary.daily_temperatures.skipped}</span> {t.excel.skipped}</li>
            <li>🌾 Ζύγιση Τροφής: <span className="text-emerald-400">{summary.feed_logs.inserted}</span> {t.excel.inserted}, <span className="text-amber-400">{summary.feed_logs.skipped}</span> {t.excel.skipped}</li>
          </ul>
          {summary.errors.length > 0 && (
            <details className="mt-3">
              <summary className="text-red-400 cursor-pointer text-xs">{t.excel.errors} ({summary.errors.length})</summary>
              <ul className="mt-2 space-y-0.5 text-xs text-red-300">
                {summary.errors.slice(0, 30).map((e, i) => <li key={i}>• {e}</li>)}
                {summary.errors.length > 30 && <li className="text-gray-500">... και {summary.errors.length - 30} ακόμα</li>}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
