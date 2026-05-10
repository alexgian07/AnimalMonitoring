"use client";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

interface Match {
  id: string;
  tag: string;
  sex: string;
  status: string;
  location_id: string;
  locations: { name: string } | null;
}

export default function TurkeySearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (q.length < 1) { setResults([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/turkey-search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        if (r.ok) setResults(await r.json());
      } catch {}
    }, 200);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(id: string) {
    setOpen(false);
    setQ("");
    router.push(`/dashboard/turkeys/${id}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && results[0]) {
      handleSelect(results[0].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative px-3 mb-3">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-2.5 text-gray-500" />
        <input
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Αναζήτηση ζώου..."
          className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-8 pr-3 py-1.5 text-white text-xs placeholder:text-gray-500 focus:outline-none focus:border-emerald-600"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute left-3 right-3 mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto">
          {results.map(r => (
            <button
              key={r.id}
              onClick={() => handleSelect(r.id)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-gray-700 border-b border-gray-700/50 last:border-0"
            >
              <div className="text-white font-mono">{r.tag}</div>
              <div className="text-gray-500">{r.locations?.name ?? "—"} · {r.sex}</div>
            </button>
          ))}
        </div>
      )}
      {open && q && results.length === 0 && (
        <div className="absolute left-3 right-3 mt-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-gray-500 z-20">
          Δεν βρέθηκαν ζώα
        </div>
      )}
    </div>
  );
}
