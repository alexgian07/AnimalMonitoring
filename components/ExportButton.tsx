"use client";
import { Download } from "lucide-react";
import { t } from "@/lib/i18n";

export default function ExportButton() {
  return (
    <a
      href="/api/export"
      download
      className="inline-flex items-center gap-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 rounded-lg transition-colors"
    >
      <Download size={14} />
      {t.excel.export}
    </a>
  );
}
