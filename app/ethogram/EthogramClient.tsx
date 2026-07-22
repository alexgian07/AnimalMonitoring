"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { BEHAVIOURS, CELLS, OBS, CATS, parseToOps, type Op } from "@/lib/ethogram/parser";

/* ---------------- state + reducer ---------------- */
type HistEntry = { obs: number; cell: number; beh: number; delta: number };
type State = {
  data: number[][][]; // [obs][cell][beh]
  obs: number;
  active: number;
  lastBehaviour: number | null;
  history: HistEntry[];
};

function initState(): State {
  return {
    data: Array.from({ length: OBS }, () => CELLS.map(() => BEHAVIOURS.map(() => 0))),
    obs: 0,
    active: 0,
    lastBehaviour: null,
    history: [],
  };
}
const cloneData = (d: number[][][]) => d.map((o) => o.map((c) => c.slice()));

type Action =
  | { type: "ops"; ops: Op[] }
  | { type: "bump"; beh: number; d: number }
  | { type: "setObs"; o: number }
  | { type: "setCell"; c: number }
  | { type: "next" }
  | { type: "clearCell" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "ops": {
      const data = cloneData(state.data);
      const history = state.history.map((h) => ({ ...h }));
      let { obs, active, lastBehaviour } = state;
      const add = (beh: number | null, n: number) => {
        if (beh == null || !n) return;
        data[obs][active][beh] += n;
        lastBehaviour = beh;
        history.push({ obs, cell: active, beh, delta: n });
      };
      const undo = () => {
        const h = history.pop();
        if (!h) return;
        data[h.obs][h.cell][h.beh] = Math.max(0, data[h.obs][h.cell][h.beh] - h.delta);
      };
      const setLast = (n: number) => {
        const h = history[history.length - 1];
        if (!h) return;
        data[h.obs][h.cell][h.beh] = Math.max(0, data[h.obs][h.cell][h.beh] - h.delta + n);
        h.delta = n;
      };
      for (const op of action.ops) {
        if (op.t === "add") add(op.beh, op.n);
        else if (op.t === "addLast") add(lastBehaviour, op.n);
        else if (op.t === "undo") undo();
        else if (op.t === "setLast") setLast(op.n);
        else if (op.t === "cell") active = Math.max(0, Math.min(CELLS.length - 1, op.cell));
        else if (op.t === "next") {
          if (active < CELLS.length - 1) active++;
          else if (obs < OBS - 1) { obs++; active = 0; }
        }
      }
      return { data, history, obs, active, lastBehaviour };
    }
    case "bump": {
      const data = cloneData(state.data);
      const history = state.history.map((h) => ({ ...h }));
      let lastBehaviour = state.lastBehaviour;
      data[state.obs][state.active][action.beh] = Math.max(0, data[state.obs][state.active][action.beh] + action.d);
      if (action.d > 0) { lastBehaviour = action.beh; history.push({ obs: state.obs, cell: state.active, beh: action.beh, delta: action.d }); }
      return { ...state, data, history, lastBehaviour };
    }
    case "setObs":
      return { ...state, obs: Math.max(0, Math.min(OBS - 1, action.o)) };
    case "setCell":
      return { ...state, active: Math.max(0, Math.min(CELLS.length - 1, action.c)) };
    case "next": {
      let { obs, active } = state;
      if (active < CELLS.length - 1) active++;
      else if (obs < OBS - 1) { obs++; active = 0; }
      return { ...state, obs, active };
    }
    case "clearCell": {
      const data = cloneData(state.data);
      data[state.obs][state.active] = BEHAVIOURS.map(() => 0);
      const history = state.history.filter((h) => !(h.obs === state.obs && h.cell === state.active));
      return { ...state, data, history };
    }
    default:
      return state;
  }
}

/* ---------------- component ---------------- */
export default function EthogramClient({ commitEnabled }: { commitEnabled: boolean }) {
  const [state, dispatch] = useReducer(reducer, undefined, initState);
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [ampm, setAmpm] = useState<"Π" | "Μ">("Π");
  const [heard, setHeard] = useState<{ text: string; err?: boolean }>({ text: "Pick observation + cell, tap Record, speak the tallies, tap Stop." });
  const [recState, setRecState] = useState<"idle" | "recording" | "busy">("idle");
  const [showGrid, setShowGrid] = useState(false);
  const [note, setNote] = useState("");

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // recording timer (count-up; target is ~1 minute per cell)
  const [elapsed, setElapsed] = useState(0); // seconds
  const timerRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const buzzedRef = useRef(false);
  const TARGET = 60;

  function startTimer() {
    startRef.current = Date.now();
    buzzedRef.current = false;
    setElapsed(0);
    timerRef.current = window.setInterval(() => {
      const s = (Date.now() - startRef.current) / 1000;
      setElapsed(s);
      if (s >= TARGET && !buzzedRef.current) {
        buzzedRef.current = true;
        if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate([300, 120, 300]);
      }
    }, 250);
  }
  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }
  useEffect(() => () => stopTimer(), []);
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

  const { data, obs, active } = state;

  const tabName = () => {
    if (!dateStr) return "—";
    const [, m, d] = dateStr.split("-").map(Number);
    return `${d}-${m} ${ampm}`;
  };
  const cellHasData = (o: number, c: number) => data[o][c].some((v) => v > 0);
  const doneCount = () => {
    let n = 0;
    for (let o = 0; o < OBS; o++) for (let c = 0; c < CELLS.length; c++) if (cellHasData(o, c)) n++;
    return n;
  };
  const cellTotal = data[obs][active].reduce((a, b) => a + b, 0);

  const buildRows = (): (string | number)[][] => {
    const head = ["OBSERV.", "Cell", ...BEHAVIOURS.map((b) => b.name)];
    const rows: (string | number)[][] = [head];
    for (let o = 0; o < OBS; o++)
      for (let c = 0; c < CELLS.length; c++) {
        const counts = data[o][c];
        const sum = counts.reduce((a, b) => a + b, 0);
        // trailing per-row Σ total to match the existing filled tabs
        rows.push([o + 1, CELLS[c], ...counts.map((v) => (v || "") as string | number), sum || ""]);
      }
    return rows;
  };

  /* ---- recording ---- */
  async function toggleRecord() {
    if (recState === "recording") { mediaRef.current?.stop(); return; }
    try {
      if (!streamRef.current)
        streamRef.current = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
        });
    } catch (e) {
      setHeard({ text: "⚠ microphone blocked: " + e, err: true });
      return;
    }
    const mime = MediaRecorder.isTypeSupported("audio/webm")
      ? "audio/webm"
      : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : undefined);
    mediaRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = async () => {
      stopTimer();
      setRecState("busy");
      setHeard({ text: "… transcribing" });
      const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      try {
        const res = await fetch("/api/ethogram/transcribe", {
          method: "POST",
          headers: { "content-type": blob.type || "audio/webm" },
          body: blob,
        });
        const d = await res.json();
        if (d.text != null) {
          setHeard({ text: d.text.trim() || "(nothing heard)" });
          dispatch({ type: "ops", ops: parseToOps(d.text) });
        } else {
          setHeard({ text: "⚠ " + (d.error?.message || d.error || JSON.stringify(d)), err: true });
        }
      } catch (e) {
        setHeard({ text: "⚠ network: " + e, err: true });
      }
      setRecState("idle");
    };
    rec.start();
    startTimer();
    setRecState("recording");
    setHeard({ text: "listening… speak the tallies, tap Stop when done" });
  }

  /* ---- export / commit ---- */
  async function copyGrid() {
    try {
      await navigator.clipboard.writeText(buildRows().map((r) => r.join("\t")).join("\n"));
      setNote(`48 rows copied — paste into the ${tabName()} tab`);
    } catch {
      setNote("Copy failed — use CSV");
    }
    setTimeout(() => setNote(""), 2500);
  }
  function downloadCsv() {
    const csv = buildRows().map((r) => r.join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `ethogram ${tabName()}.csv`;
    a.click();
  }
  async function commit() {
    if (!confirm(`Commit tab "${tabName()}" to Google Sheets?\n${doneCount()}/48 cells have data.`)) return;
    setNote("Committing " + tabName() + "…");
    try {
      const res = await fetch("/api/ethogram/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tabName: tabName(), rows: buildRows() }),
      });
      const d = await res.json();
      if (res.ok) setNote("✓ Committed to tab " + d.committed.tab);
      else if (d.code === "TAB_EXISTS") setNote("⚠ Tab " + tabName() + " already exists — rename or delete it first");
      else setNote("⚠ " + (d.error || "commit failed"));
    } catch (e) {
      setNote("⚠ " + e);
    }
    setTimeout(() => setNote(""), 4000);
  }

  /* ---------------- render ---------------- */
  const chip = (on: boolean, done = false) =>
    `flex-none min-w-[46px] px-3 py-2.5 rounded-xl font-bold text-base transition-colors ${
      on ? "bg-emerald-600 text-white" : "bg-gray-800 text-gray-200 hover:bg-gray-700"
    } ${done && !on ? "ring-2 ring-emerald-500/70" : ""}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 text-gray-100">
      <h1 className="text-lg font-semibold mb-1">🐦 Ethogram Voice</h1>
      <p className="text-xs text-gray-400 mb-4">
        Pick a cell → record while you watch it → the counts fill in. Tap ＋ / − to fix anything.
      </p>

      {/* session bar */}
      <div className="flex flex-wrap items-center gap-2 bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-base"
        />
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(["Π", "Μ"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setAmpm(v)}
              className={`px-3 py-1.5 text-sm ${ampm === v ? "bg-emerald-600 text-white font-bold" : "bg-gray-800 text-gray-200"}`}
            >
              {v === "Π" ? "Πρωί · AM" : "Μεσ. · PM"}
            </button>
          ))}
        </div>
        <span className="ml-auto font-bold text-emerald-400">{tabName()}</span>
      </div>

      {/* observation selector */}
      <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5 mt-2">Observation</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: OBS }, (_, o) => (
          <button key={o} onClick={() => dispatch({ type: "setObs", o })} className={chip(o === obs)}>
            {o + 1}
          </button>
        ))}
      </div>

      {/* cell selector */}
      <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5 mt-3">Cell</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {CELLS.map((c, i) => (
          <button key={c} onClick={() => dispatch({ type: "setCell", c: i })} className={chip(i === active, cellHasData(obs, i))}>
            {c}
          </button>
        ))}
      </div>

      {/* progress */}
      <div className="flex justify-between items-center text-sm mt-3 mb-1">
        <span>
          Obs <b className="text-emerald-400">{obs + 1}</b>/6 · Cell <b className="text-emerald-400">{CELLS[active]}</b>
        </span>
        <span>
          <b className="text-emerald-400">{doneCount()}</b> / 48 cells done
        </span>
      </div>

      {/* record + next */}
      <div className="flex gap-2 my-2">
        <button
          onClick={toggleRecord}
          disabled={recState === "busy"}
          className={`flex-1 py-5 rounded-2xl text-lg font-bold transition-colors ${
            recState === "recording"
              ? "bg-red-500 text-white animate-pulse"
              : recState === "busy"
                ? "bg-gray-800 text-gray-400"
                : "bg-emerald-600 hover:bg-emerald-500 text-white"
          }`}
        >
          {recState === "recording" ? "⏹ Stop & transcribe" : recState === "busy" ? "… transcribing" : `🎤 Record — Obs ${obs + 1} · ${CELLS[active]}`}
        </button>
        <button onClick={() => dispatch({ type: "next" })} className="flex-none w-[88px] rounded-2xl bg-gray-800 hover:bg-gray-700 font-bold">
          Next ▸
        </button>
      </div>

      {/* recording timer */}
      {recState === "recording" && (
        <div className={`flex items-center justify-center gap-2 mb-2 text-3xl font-bold tabular-nums ${elapsed >= TARGET ? "text-amber-400" : "text-emerald-400"}`}>
          ⏱ {mmss(elapsed)}
          {elapsed >= TARGET && <span className="text-sm font-medium">· 1 min — you can stop</span>}
        </div>
      )}

      {/* heard */}
      <div className={`min-h-[44px] rounded-xl px-3 py-2.5 text-sm leading-snug mb-3 bg-gray-950 border border-gray-800 ${heard.err ? "text-red-400" : "text-gray-300"}`}>
        {heard.text}
      </div>

      {/* active cell list */}
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-bold">Obs {obs + 1} · {CELLS[active]}</span>
        <span className="text-xs text-gray-400">{cellTotal ? cellTotal + " scored" : ""}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {BEHAVIOURS.map((b, bi) => {
          const v = data[obs][active][bi];
          return (
            <div key={b.name} className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 border ${v ? "bg-emerald-950/40 border-emerald-800" : "bg-gray-900 border-gray-800"}`}>
              <div className="flex-1">
                <div className="text-[15px]">{b.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{CATS[b.cat]}</div>
              </div>
              <button onClick={() => dispatch({ type: "bump", beh: bi, d: -1 })} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-xl font-bold">−</button>
              <div className={`min-w-[28px] text-center text-lg font-extrabold ${v ? "text-emerald-400" : "text-gray-500"}`}>{v}</div>
              <button onClick={() => dispatch({ type: "bump", beh: bi, d: 1 })} className="w-9 h-9 rounded-lg bg-gray-800 hover:bg-gray-700 text-xl font-bold">＋</button>
            </div>
          );
        })}
      </div>

      {/* actions */}
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => setShowGrid((s) => !s)} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">▦ Full grid (48)</button>
        <button onClick={copyGrid} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">📋 Copy for Excel</button>
        <button onClick={downloadCsv} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">⬇ CSV</button>
        <button onClick={() => { if (confirm(`Clear counts in Obs ${obs + 1} · ${CELLS[active]}?`)) dispatch({ type: "clearCell" }); }} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">↺ Clear this cell</button>
      </div>

      {commitEnabled && (
        <div className="flex mt-2">
          <button onClick={commit} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold">
            ⬆ Commit day to Google Sheets
          </button>
        </div>
      )}

      {note && <div className="mt-3 text-sm text-emerald-400">{note}</div>}

      {/* full grid */}
      {showGrid && (
        <div className="mt-4 overflow-auto border border-gray-800 rounded-lg max-h-[70vh]">
          <table className="border-collapse text-xs">
            <thead>
              <tr>
                <th className="sticky top-0 left-0 z-10 bg-gray-800 px-2 py-1">Obs</th>
                <th className="sticky top-0 bg-gray-800 px-2 py-1">Cell</th>
                {BEHAVIOURS.map((b) => (
                  <th key={b.name} className="sticky top-0 bg-gray-800 h-28 align-bottom">
                    <span className="[writing-mode:vertical-rl] rotate-180 inline-block py-1.5 text-[10px]">{b.name}</span>
                  </th>
                ))}
                <th className="sticky top-0 bg-gray-800 px-2 py-1">Σ</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: OBS }, (_, o) =>
                CELLS.map((c, ci) => {
                  const on = o === obs && ci === active;
                  const sum = data[o][ci].reduce((a, b) => a + b, 0);
                  return (
                    <tr key={`${o}-${ci}`} className={on ? "bg-emerald-900/40" : ""}>
                      <td className={`border border-gray-800 text-center px-2 ${ci === 0 ? "bg-gray-800/60 font-bold" : "bg-gray-900"}`}>{ci === 0 ? o + 1 : ""}</td>
                      <td className="border border-gray-800 text-center px-2 font-bold bg-gray-800/60">{c}</td>
                      {data[o][ci].map((v, bi) => (
                        <td key={bi} className="border border-gray-800 text-center px-1 bg-gray-900 min-w-[32px]">{v || ""}</td>
                      ))}
                      <td className="border border-gray-800 text-center px-2 font-bold text-emerald-400 bg-emerald-950/40">{sum || ""}</td>
                    </tr>
                  );
                }),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
