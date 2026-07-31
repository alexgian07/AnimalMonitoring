"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import { BEHAVIOURS, CELLS, OBS, CATS, behavioursFor, parseToOps, type Op } from "@/lib/ethogram/parser";
import { toWav16kMono } from "@/lib/ethogram/wav";

/* ---------------- state + reducer ---------------- */
type HistEntry = { obs: number; cell: number; beh: number; delta: number };
type State = {
  data: number[][][]; // [obs][cell][beh]
  obs: number;
  active: number;
  lastBehaviour: number | null;
  history: HistEntry[];
};

// empty [obs][cell][beh] grid for a given cell count (inside = 8 cells, free-range = 1) and
// behaviour count (inside = 22, free-range = 23 incl. Foraging), plus a normaliser that coerces a
// stored grid back to the expected dimensions (also pads older free-range grids to 23 behaviours).
const emptyGrid = (cellCount: number, behCount: number): number[][][] =>
  Array.from({ length: OBS }, () => Array.from({ length: cellCount }, () => Array.from({ length: behCount }, () => 0)));
const normalizeGrid = (raw: unknown, cellCount: number, behCount: number): number[][][] => {
  const g = emptyGrid(cellCount, behCount);
  const r = raw as number[][][] | undefined;
  for (let o = 0; o < OBS; o++)
    for (let c = 0; c < cellCount; c++)
      for (let b = 0; b < behCount; b++) {
        const v = r?.[o]?.[c]?.[b];
        if (typeof v === "number" && v > 0) g[o][c][b] = v;
      }
  return g;
};

function initState(): State {
  return { data: emptyGrid(CELLS.length, BEHAVIOURS.length), obs: 0, active: 0, lastBehaviour: null, history: [] };
}
const cloneData = (d: number[][][]) => d.map((o) => o.map((c) => c.slice()));

// small inline spinner; inherits text color via border-current
const Spinner = ({ className = "" }: { className?: string }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
);

type Action =
  | { type: "ops"; ops: Op[] }
  | { type: "bump"; beh: number; d: number }
  | { type: "setObs"; o: number }
  | { type: "setCell"; c: number }
  | { type: "next" }
  | { type: "clearCell" }
  | { type: "setCounts"; counts: number[] }
  | { type: "hydrate"; data: number[][][] };

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
        else if (op.t === "cell") active = Math.max(0, Math.min(data[0].length - 1, op.cell));
        else if (op.t === "next") {
          if (active < data[0].length - 1) active++;
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
      return { ...state, active: Math.max(0, Math.min(state.data[0].length - 1, action.c)) };
    case "next": {
      let { obs, active } = state;
      if (active < state.data[0].length - 1) active++;
      else if (obs < OBS - 1) { obs++; active = 0; }
      return { ...state, obs, active };
    }
    case "clearCell": {
      const data = cloneData(state.data);
      data[state.obs][state.active] = data[state.obs][state.active].map(() => 0);
      const history = state.history.filter((h) => !(h.obs === state.obs && h.cell === state.active));
      return { ...state, data, history };
    }
    case "setCounts": {
      // LLM result for the current clip → set the active cell's counts outright (a clip replaces
      // the cell). Drop this cell's manual history since we've overwritten it.
      const data = cloneData(state.data);
      data[state.obs][state.active] = data[state.obs][state.active].map((_, i) => Math.max(0, Math.round(action.counts[i] || 0)));
      const history = state.history.filter((h) => !(h.obs === state.obs && h.cell === state.active));
      return { ...state, data, history, lastBehaviour: null };
    }
    case "hydrate":
      // Replace the whole grid (from a loaded session); reset position + history.
      return { data: cloneData(action.data), obs: 0, active: 0, lastBehaviour: null, history: [] };
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
  // which animal space: "inside" (K1–K8 cells) or "free_range" (no cells, per-observation)
  const [space, setSpace] = useState<"inside" | "free_range">("inside");
  const cellCount = space === "free_range" ? 1 : CELLS.length;
  const isFree = space === "free_range";
  // behaviour set for this space: free-range = 22 + Foraging (23), inside = 22
  const behs = behavioursFor(space);
  const behCount = behs.length;
  const [heard, setHeard] = useState<{ text: string; err?: boolean }>({ text: "Pick observation + cell, tap Record, speak the tallies, tap Stop." });
  const [recState, setRecState] = useState<"idle" | "recording" | "busy">("idle");
  const [showGrid, setShowGrid] = useState(false);
  const [note, setNote] = useState("");

  // persistence: autosave / resume
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [sessionStatus, setSessionStatus] = useState<"draft" | "committed" | null>(null);
  // true when a committed session has local edits not yet pushed to the Sheet (updated_at > committed_at)
  const [dirtySinceCommit, setDirtySinceCommit] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);   // resume/reconcile fetch in flight
  const [committing, setCommitting] = useState(false);          // commit/replace request in flight
  const [committedByOther, setCommittedByOther] = useState<string | null>(null); // another researcher committed this slot
  const hydratingRef = useRef(false);       // true = the next grid change is a load, not a user edit
  const saveTimerRef = useRef<number | null>(null);
  // the latest not-yet-saved payload, so switching session/leaving can FLUSH it instead of dropping it
  type SavePayload = { date: string; ampm: string; space: string; template: string; data: number[][][] };
  const pendingSaveRef = useRef<SavePayload | null>(null);
  // saved transcript per cell, keyed `${obs}-${cell}` (0-based); shown on resume
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});
  const recCellRef = useRef<{ obs: number; cell: number }>({ obs: 0, cell: 0 });
  // past-sessions browser
  type PastSession = { date: string; ampm: string; status: string; sheetTab: string | null; updatedAt: string; filled: number; mine: boolean; by: string | null };
  const [showPast, setShowPast] = useState(false);
  const [pastSessions, setPastSessions] = useState<PastSession[] | null>(null);

  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const discardRef = useRef(false);

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

  // Load a saved session for this (date, time-of-day) so a refresh/crash can resume it,
  // and reset the grid whenever the session identity changes.
  useEffect(() => {
    hydratingRef.current = true;              // block the autosave tick this render triggers
    setLoadingSession(true);
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/ethogram/session?date=${dateStr}&ampm=${encodeURIComponent(ampm)}&space=${space}`);
        const d = await res.json();
        if (cancelled) return;
        hydratingRef.current = true;          // block the autosave the hydrate dispatch triggers
        if (d.session?.data?.length) {
          dispatch({ type: "hydrate", data: normalizeGrid(d.session.data, cellCount, behCount) });
          setSessionStatus(d.session.status ?? "draft");
          setHeard({
            text: d.session.status === "committed"
              ? "This session was already committed to Google Sheets — editing here won't change the Sheet."
              : "Resumed your saved session.",
          });
        } else {
          dispatch({ type: "hydrate", data: emptyGrid(cellCount, behCount) });
          setSessionStatus(null);
        }
        // committed session with edits after the commit → "edited since commit".
        // 2s tolerance so the sub-ms skew of older commits (which set the two timestamps in
        // separate now() calls) isn't mistaken for a real later edit; genuine edits are seconds+ later.
        setDirtySinceCommit(
          d.session?.status === "committed" && !!d.session.updated_at && !!d.session.committed_at &&
          new Date(d.session.updated_at).getTime() - new Date(d.session.committed_at).getTime() > 2000,
        );
        // rebuild the per-cell transcript map (obs/cell come back 1-based)
        const tmap: Record<string, string> = {};
        for (const r of (d.recordings ?? []) as { obs: number; cell: number; transcript: string }[])
          tmap[`${r.obs - 1}-${r.cell - 1}`] = r.transcript;
        setTranscripts(tmap);
        setCommittedByOther(d.committedByOther ?? null);
        setSaveState("idle");
      } catch {
        if (!cancelled) hydratingRef.current = false;   // load failed → allow normal saving
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr, ampm, space]);

  // Debounced autosave of the working grid (~1.5s after the last change).
  useEffect(() => {
    if (hydratingRef.current) { hydratingRef.current = false; return; }   // skip loads
    const total = state.data.reduce((s, o) => s + o.reduce((s2, c) => s2 + c.reduce((a, b) => a + b, 0), 0), 0);
    if (total === 0) return;                  // nothing worth persisting yet
    if (sessionStatus === "committed") setDirtySinceCommit(true);   // edits diverge from the Sheet
    setSaveState("saving");
    pendingSaveRef.current = { date: dateStr, ampm, space, template: isFree ? "free-range" : "22-july", data: state.data };
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(async () => {
      const p = pendingSaveRef.current;
      if (!p) return;
      try {
        const res = await fetch("/api/ethogram/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(p),
        });
        if (!res.ok) throw new Error();
        const d = await res.json();
        pendingSaveRef.current = null;
        setSaveState("saved");
        if (d.status) setSessionStatus(d.status);
      } catch {
        setSaveState("error");
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.data, dateStr, ampm, space]);

  // Flush a pending debounced save when the session identity changes (or on unmount), so edits
  // made just before switching date/AM-PM/space are never dropped. Uses the stored payload (old
  // identity), so it saves the session being left — not the one being opened.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null; }
      const p = pendingSaveRef.current;
      if (p) {
        pendingSaveRef.current = null;
        void fetch("/api/ethogram/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(p),
        }).catch(() => {});
      }
    };
  }, [dateStr, ampm, space]);

  const { data, obs, active } = state;

  // Inside → "D-M Π/Μ" (one tab per half). Free-range → "D-M" (one tab per day, holds both halves).
  const dayName = () => {
    if (!dateStr) return "—";
    const [, m, d] = dateStr.split("-").map(Number);
    return `${d}-${m}`;
  };
  const tabName = () => (dateStr ? (isFree ? dayName() : `${dayName()} ${ampm}`) : "—");
  // null-safe: during a space switch the grid dims briefly mismatch the layout (data reloads async)
  const cellHasData = (o: number, c: number) => !!data[o]?.[c]?.some((v) => v > 0);
  const doneCount = () => {
    let n = 0;
    for (let o = 0; o < OBS; o++) for (let c = 0; c < cellCount; c++) if (cellHasData(o, c)) n++;
    return n;
  };
  const totalUnits = OBS * cellCount;   // 48 (inside) or 6 (free-range)
  const cellTotal = (data[obs]?.[active] ?? []).reduce((a, b) => a + b, 0);
  // The status box shows the CURRENT cell's saved transcript when idle; otherwise the live
  // status/instruction/error text. Derived (not stored) so it's always right for this cell.
  const activeTranscript = transcripts[`${obs}-${active}`];
  const boxText = recState === "idle" && !heard.err && activeTranscript ? activeTranscript : heard.text;
  const todayStr = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();
  const dateInFuture = !!dateStr && dateStr > todayStr;

  const buildRows = (): (string | number)[][] => {
    if (isFree) {
      // free-range: one block for the current half — (time) | OBSERV | 23 behaviours incl. Foraging (no Cell/Σ)
      const head = ["", "OBSERV.", ...behs.map((b) => b.name)];
      const rows: (string | number)[][] = [head];
      const label = ampm === "Π" ? "ΠΡΩΙ" : "ΜΕΣΗΜΕΡΙ";
      for (let o = 0; o < OBS; o++)
        rows.push([o === 0 ? label : "", o + 1, ...data[o][0].map((v) => (v || "") as string | number)]);
      return rows;
    }
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
    // Redo: if this cell already has counts, a fresh recording replaces them (no accumulating).
    if (data[obs][active].some((v) => v > 0)) {
      if (!confirm(`Re-record Obs ${obs + 1}${isFree ? "" : ` · ${CELLS[active]}`}?\nIts current counts will be cleared and replaced.`)) return;
      dispatch({ type: "clearCell" });
      setTranscripts((m) => { const n = { ...m }; delete n[`${obs}-${active}`]; return n; });
    }
    recCellRef.current = { obs, cell: active };   // the cell this clip belongs to
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
    // Cap the audio bitrate so long clips stay small: some phones default to a high bitrate and a
    // longer/short-but-dense clip can exceed the platform's ~4.5MB request cap ("too long"). 48kbps
    // is transparent for speech (Whisper downsamples to 16kHz mono anyway); an 80s clip ≈ 0.5MB.
    // This is only a hint — unsupported codecs silently fall back to the browser default (no regression).
    const recOpts: MediaRecorderOptions = { audioBitsPerSecond: 48000 };
    if (mime) recOpts.mimeType = mime;
    const rec = new MediaRecorder(streamRef.current, recOpts);
    mediaRef.current = rec;
    chunksRef.current = [];
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    rec.onstop = async () => {
      stopTimer();
      if (discardRef.current) {           // user cancelled — throw the take away, add nothing
        discardRef.current = false;
        setRecState("idle");
        setHeard({ text: "Recording discarded — nothing added." });
        return;
      }
      setRecState("busy");
      setHeard({ text: "… transcribing" });
      const raw = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
      // Down-encode to 16kHz mono WAV so the upload size is deterministic (~32KB/s) regardless of the
      // device's real bitrate — keeps long clips under Vercel's ~4.5MB body cap (audioBitsPerSecond is
      // only a hint and is ignored on some phones). Falls back to `raw` if the browser can't decode.
      const { blob: upload, reencoded } = await toWav16kMono(raw);
      try {
        const res = await fetch(`/api/ethogram/transcribe?space=${space}`, {
          method: "POST",
          headers: { "content-type": upload.type || "audio/webm" },
          body: upload,
        });
        if (!res.ok) {
          // A 413 (payload too large) is rejected at the platform edge and never hits our function, so
          // it isn't in the server logs — beacon the sizes/status so we can still see it. Best-effort.
          fetch("/api/ethogram/clientlog", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              stage: "transcribe", status: res.status, rawBytes: raw.size, uploadBytes: upload.size,
              reencoded, mime: raw.type, ua: typeof navigator !== "undefined" ? navigator.userAgent : "",
            }),
          }).catch(() => {});
          setHeard({
            text: res.status === 413
              ? "⚠ clip too large to upload — please record a shorter take."
              : `⚠ upload failed (${res.status}) — please try again.`,
            err: true,
          });
          setRecState("idle");
          return;
        }
        const d = await res.json();
        if (d.text != null) {
          const text = d.text.trim();
          // LLM counts if available; otherwise fall back to the deterministic parser on the text
          if (Array.isArray(d.counts)) dispatch({ type: "setCounts", counts: d.counts });
          else dispatch({ type: "ops", ops: parseToOps(d.text) });
          if (text) {
            const { obs: ro, cell: rc } = recCellRef.current;
            // transcript is shown via the (derived) status box; reset heard to the prompt
            setHeard({ text: "Pick observation + cell, tap Record, speak the tallies, tap Stop." });
            setTranscripts((m) => ({ ...m, [`${ro}-${rc}`]: text }));
            // persist the transcript (audit trail); best-effort, never blocks the UI
            fetch("/api/ethogram/recording", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ date: dateStr, ampm, space, obs: ro + 1, cell: rc + 1, transcript: text }),
            }).catch(() => {});
          } else {
            setHeard({ text: "(nothing heard)" });
          }
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

  function cancelRecording() {
    discardRef.current = true;      // onstop will see this and discard the clip
    mediaRef.current?.stop();       // stop without transcribing
  }

  /* ---- export / commit ---- */
  async function copyGrid() {
    try {
      await navigator.clipboard.writeText(buildRows().map((r) => r.join("\t")).join("\n"));
      setNote(`Copied — paste into the ${tabName()} tab`);
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
  async function loadPast() {
    setPastSessions(null);
    try {
      const res = await fetch(`/api/ethogram/sessions?space=${space}`);
      const d = await res.json();
      setPastSessions(d.sessions ?? []);
    } catch {
      setPastSessions([]);
    }
  }

  async function clearDay() {
    if (!confirm(
      `Clear "${tabName()}"?\n\n` +
      `This wipes all ${OBS} observations for this ${isFree ? "half-day" : "cell set"} and removes the saved session. ` +
      `It does NOT delete anything already written to Google Sheets.`,
    )) return;
    hydratingRef.current = true;            // stop autosave from re-creating the row from the blank grid
    dispatch({ type: "hydrate", data: emptyGrid(cellCount, behCount) });
    setSessionStatus(null);
    setSaveState("idle");
    setTranscripts({});
    try {
      await fetch(`/api/ethogram/session?date=${dateStr}&ampm=${encodeURIComponent(ampm)}&space=${space}`, { method: "DELETE" });
      setNote("Cleared " + tabName() + " — the Google Sheet was not touched");
      if (showPast) loadPast();   // refresh the history list so the cleared day disappears
    } catch {
      setNote("⚠ could not clear the saved session");
    }
    setTimeout(() => setNote(""), 3500);
  }

  async function commit() {
    const msg = isFree
      ? `Commit day "${tabName()}" to Google Sheets?\nSaves everything entered for this day so far — you can commit again any time to update it.`
      : `Commit tab "${tabName()}" to Google Sheets?\n${doneCount()}/${totalUnits} cells have data.`;
    if (!confirm(msg)) return;
    setCommitting(true);
    setNote("Committing " + tabName() + "…");
    try {
      const res = await fetch("/api/ethogram/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tabName: tabName(), sessionDate: dateStr, timeOfDay: ampm, space,
          // inside → prebuilt 48 rows; free-range → raw grid (server assembles the day + sibling half)
          ...(isFree ? { data: state.data } : { rows: buildRows() }),
        }),
      });
      const d = await res.json();
      if (res.ok) { setNote("✓ Committed to tab " + d.committed.tab); setSessionStatus("committed"); setDirtySinceCommit(false); }
      // A collision on a NOT-yet-committed INSIDE day means a foreign/manual tab — never auto-overwrite.
      else if (!isFree && d.code === "TAB_EXISTS")
        setNote(`⚠ Tab ${tabName()} already exists (not created here) — rename or delete it in Google Sheets first.`);
      else setNote("⚠ " + (d.error || "commit failed"));
    } catch (e) {
      setNote("⚠ " + e);
    } finally {
      setCommitting(false);
    }
    setTimeout(() => setNote(""), 6000);
  }

  async function replaceCommit() {
    if (!confirm(
      `Replace the existing tab "${tabName()}" in Google Sheets?\n\n` +
      `Its 48 rows will be overwritten with the current data. Google Sheets keeps version history if you need to undo.`,
    )) return;
    setCommitting(true);
    setNote("Replacing " + tabName() + "…");
    try {
      const res = await fetch("/api/ethogram/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tabName: tabName(), rows: buildRows(), sessionDate: dateStr, timeOfDay: ampm, replace: true }),
      });
      const d = await res.json();
      if (res.ok) { setNote("✓ Replaced tab " + d.committed.tab); setSessionStatus("committed"); setDirtySinceCommit(false); }
      else if (d.code === "NOT_APP_OWNED" || d.code === "TAB_SHAPE_MISMATCH") setNote("⚠ " + d.error);
      else setNote("⚠ " + (d.error || "replace failed"));
    } catch (e) {
      setNote("⚠ " + e);
    } finally {
      setCommitting(false);
    }
    setTimeout(() => setNote(""), 6000);
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
        <select
          value={space}
          onChange={(e) => setSpace(e.target.value as "inside" | "free_range")}
          className="bg-gray-800 border border-gray-700 rounded-lg px-2.5 py-1.5 text-sm font-semibold"
          title="Which animal space"
        >
          <option value="inside">🏠 Inside</option>
          <option value="free_range">🌿 Free range</option>
        </select>
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
        <span className="ml-auto flex flex-col items-end leading-tight">
          <span className="font-bold text-emerald-400">{tabName()}</span>
          <span className={`text-[10px] h-3 ${
            sessionStatus === "committed" && dirtySinceCommit ? "text-amber-400"
              : sessionStatus === "committed" ? "text-emerald-400"
                : saveState === "error" ? "text-red-400" : "text-gray-400"
          }`}>
            {sessionStatus === "committed"
              ? (dirtySinceCommit ? "✎ edited since commit" : "✓ committed")
              : saveState === "saving"
                ? "saving…"
                : saveState === "saved"
                  ? "saved ✓"
                  : saveState === "error"
                    ? "⚠ not saved"
                    : ""}
          </span>
        </span>
      </div>

      {loadingSession && (
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3 -mt-1">
          <Spinner className="h-4 w-4 text-emerald-400" /> Loading session…
        </div>
      )}

      {dateInFuture && (
        <div className="text-[11px] text-amber-400 mb-3 -mt-2">⚠ This date is in the future — check it's the right day.</div>
      )}

      {committedByOther && (
        <div className="text-xs text-amber-200 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2 mb-3">
          ⚠ <b>{committedByOther}</b> already committed this {isFree ? "day" : "slot"} to the Sheet. Recording here would duplicate their work — check with them first.
        </div>
      )}

      {/* observation selector */}
      <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5 mt-2">Observation</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {Array.from({ length: OBS }, (_, o) => (
          <button key={o} onClick={() => dispatch({ type: "setObs", o })} className={chip(o === obs)}>
            {o + 1}
          </button>
        ))}
      </div>

      {/* cell selector (inside only — free-range has no cells) */}
      {!isFree && (
        <>
          <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1.5 mt-3">Cell</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CELLS.map((c, i) => (
              <button key={c} onClick={() => dispatch({ type: "setCell", c: i })} className={chip(i === active, cellHasData(obs, i))}>
                {c}
              </button>
            ))}
          </div>
        </>
      )}

      {/* progress */}
      <div className="flex justify-between items-center text-sm mt-3 mb-1">
        <span>
          Obs <b className="text-emerald-400">{obs + 1}</b>/{OBS}
          {!isFree && <> · Cell <b className="text-emerald-400">{CELLS[active]}</b></>}
        </span>
        <span>
          <b className="text-emerald-400">{doneCount()}</b> / {totalUnits} {isFree ? "observations" : "cells"} done
        </span>
      </div>

      {/* record + next */}
      <div className="flex gap-2 my-2">
        {recState === "idle" && cellTotal > 0 ? (
          // filled cell → moving on is the usual action, so Next is primary and Redo is a small secondary
          <>
            <button onClick={() => dispatch({ type: "next" })} className="flex-1 py-5 rounded-2xl text-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white">
              Next ▸
            </button>
            <button onClick={toggleRecord} className="flex-none px-4 py-5 rounded-2xl bg-gray-800 hover:bg-gray-700 text-amber-300 text-sm font-semibold">
              ↻ Redo
            </button>
          </>
        ) : (
          <>
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
              {recState === "recording"
                ? "⏹ Stop & transcribe"
                : recState === "busy"
                  ? "… transcribing"
                  : `🎤 Record — Obs ${obs + 1}${isFree ? "" : ` · ${CELLS[active]}`}`}
            </button>
            <button onClick={() => dispatch({ type: "next" })} className="flex-none w-[88px] rounded-2xl bg-gray-800 hover:bg-gray-700 font-bold">
              Next ▸
            </button>
          </>
        )}
      </div>

      {/* cancel: discard the current take without transcribing */}
      {recState === "recording" && (
        <button onClick={cancelRecording} className="w-full py-2.5 mb-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm text-gray-300">
          ✕ Cancel — discard this recording
        </button>
      )}

      {/* recording timer */}
      {recState === "recording" && (
        <div className={`flex items-center justify-center gap-2 mb-2 text-3xl font-bold tabular-nums ${elapsed >= TARGET ? "text-amber-400" : "text-emerald-400"}`}>
          ⏱ {mmss(elapsed)}
          {elapsed >= TARGET && <span className="text-sm font-medium">· 1 min — you can stop</span>}
        </div>
      )}

      {/* status box — shows the current cell's saved transcript when idle, else live status */}
      <div className={`min-h-[44px] rounded-xl px-3 py-2.5 text-sm leading-snug mb-3 bg-gray-950 border border-gray-800 ${heard.err ? "text-red-400" : "text-gray-300"}`}>
        {recState === "idle" && activeTranscript ? <span className="text-gray-500 mr-1">🗣</span> : null}
        {boxText}
      </div>

      {/* active cell list */}
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="font-bold">Obs {obs + 1}{!isFree && <> · {CELLS[active]}</>}</span>
        <span className="text-xs text-gray-400">{cellTotal ? cellTotal + " scored" : ""}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {behs.map((b, bi) => {
          const v = data[obs]?.[active]?.[bi] ?? 0;
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
        {!isFree && (
          <button onClick={() => setShowGrid((s) => !s)} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">▦ Full grid (48)</button>
        )}
        <button onClick={copyGrid} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">📋 Copy for Excel</button>
        <button onClick={downloadCsv} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">⬇ CSV</button>
        <button onClick={() => { if (confirm(`Clear counts in Obs ${obs + 1}${isFree ? "" : ` · ${CELLS[active]}`}?`)) { dispatch({ type: "clearCell" }); setTranscripts((m) => { const n = { ...m }; delete n[`${obs}-${active}`]; return n; }); } }} className="flex-1 min-w-[110px] py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm">↺ Clear this {isFree ? "observation" : "cell"}</button>
      </div>

      <button onClick={clearDay} className="w-full mt-2 py-2.5 rounded-xl bg-red-950/40 border border-red-900 text-red-300 hover:bg-red-900/40 text-sm">
        🗑 Clear {isFree ? "this half-day" : "whole day"} (all {OBS} observations) — does not touch Google Sheets
      </button>

      {commitEnabled && (
        <div className="flex mt-2">
          {isFree ? (
            // free-range: one upsert button (create-or-overwrite the day tab) — override is expected here
            <button onClick={commit} disabled={committing} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-emerald-950 font-bold flex items-center justify-center gap-2">
              {committing && <Spinner className="h-4 w-4" />}
              {committing ? "Committing…" : `⬆ Commit day “${tabName()}”`}
            </button>
          ) : sessionStatus === "committed" ? (
            <button onClick={replaceCommit} disabled={committing} className="flex-1 py-3 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold flex items-center justify-center gap-2">
              {committing && <Spinner className="h-4 w-4" />}
              {committing ? "Replacing…" : `♻ Replace committed “${tabName()}” tab (overwrites it)`}
            </button>
          ) : (
            <button onClick={commit} disabled={committing} className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-emerald-950 font-bold flex items-center justify-center gap-2">
              {committing && <Spinner className="h-4 w-4" />}
              {committing ? "Committing…" : "⬆ Commit day to Google Sheets"}
            </button>
          )}
        </div>
      )}

      {note && <div className="mt-3 text-sm text-emerald-400">{note}</div>}

      {/* past sessions browser */}
      <button
        onClick={() => { const next = !showPast; setShowPast(next); if (next) loadPast(); }}
        className="w-full mt-3 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-sm"
      >
        🗂 {showPast ? "Hide past sessions" : "Past sessions"}
      </button>
      {showPast && (
        <div className="mt-2 border border-gray-800 rounded-lg divide-y divide-gray-800 max-h-[50vh] overflow-auto">
          {pastSessions === null ? (
            <div className="px-3 py-3 text-sm text-gray-400 flex items-center gap-2"><Spinner className="h-4 w-4 text-emerald-400" /> Loading…</div>
          ) : pastSessions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-gray-400">No saved sessions yet.</div>
          ) : (
            pastSessions.map((s, i) => {
              const [, m, dd] = s.date.split("-").map(Number);
              const isCurrent = s.date === dateStr && s.ampm === ampm && s.mine;
              return (
                <button
                  key={`${s.date}-${s.ampm}-${s.mine ? "me" : "o"}-${i}`}
                  onClick={() => { setDateStr(s.date); setAmpm(s.ampm as "Π" | "Μ"); setShowPast(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-800 ${isCurrent ? "bg-gray-800/60" : ""}`}
                >
                  <span className="font-bold text-emerald-400 min-w-[64px]">{dd}-{m} {s.ampm}</span>
                  <span className="text-gray-300 flex-1">
                    {s.filled}/{isFree ? OBS : 48} {isFree ? "obs" : "cells"}
                    {!s.mine && s.by && <span className="text-gray-500"> · 👤 {s.by}</span>}
                  </span>
                  <span className={`text-xs ${s.status === "committed" ? "text-emerald-400" : "text-gray-500"}`}>
                    {s.status === "committed" ? "✓ committed" : "draft"}
                  </span>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* full grid (inside only) */}
      {showGrid && !isFree && (
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
                  const cellArr = data[o]?.[ci] ?? [];   // null-safe across a space switch
                  const sum = cellArr.reduce((a, b) => a + b, 0);
                  return (
                    <tr key={`${o}-${ci}`} className={on ? "bg-emerald-900/40" : ""}>
                      <td className={`border border-gray-800 text-center px-2 ${ci === 0 ? "bg-gray-800/60 font-bold" : "bg-gray-900"}`}>{ci === 0 ? o + 1 : ""}</td>
                      <td className="border border-gray-800 text-center px-2 font-bold bg-gray-800/60">{c}</td>
                      {BEHAVIOURS.map((_, bi) => (
                        <td key={bi} className="border border-gray-800 text-center px-1 bg-gray-900 min-w-[32px]">{cellArr[bi] || ""}</td>
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
