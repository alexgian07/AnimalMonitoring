"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";

interface Props {
  endpoint: string;       // e.g. "/api/daily-temperatures"
  id: string;
  confirmText?: string;   // shown in browser confirm()
  onDeleted?: () => void; // optional callback after success
}

export default function DeleteButton({ endpoint, id, confirmText, onDeleted }: Props) {
  const [busy, setBusy] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(confirmText ?? "Είστε σίγουρη/ος ότι θέλετε διαγραφή αυτής της εγγραφής;")) return;
    setBusy(true);
    const res = await fetch(`${endpoint}?id=${id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      if (onDeleted) onDeleted();
      else window.location.reload();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.error ?? "Σφάλμα κατά τη διαγραφή");
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      title="Διαγραφή"
      className="text-gray-500 hover:text-red-400 disabled:opacity-50 transition-colors"
    >
      <Trash2 size={14} />
    </button>
  );
}
