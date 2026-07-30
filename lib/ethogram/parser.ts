/* Ethogram voice parser — pure, framework-free.
 * Turns a Whisper transcript into a list of ops that the UI reducer applies.
 * Verified against real dictation (streaming counts, "more", "that", undo,
 * "make it N", cell switching). See EthogramClient for the reducer. */

export const CATS = { gen: "general", disp: "display/reprod" } as const;

export type Behaviour = { name: string; cat: keyof typeof CATS; syn: string[] };

/* JULY tab (10-7) column order — 22 behaviours. NOTE: "scratch" alone is reserved
 * as an UNDO word, so Scratching uses -ing/-es forms only. */
export const BEHAVIOURS: Behaviour[] = [
  { name: "Walking",  cat: "gen",  syn: ["walking", "walk", "walks"] },
  { name: "Standing", cat: "gen",  syn: ["standing", "stand", "stands"] },
  { name: "Sitting",  cat: "gen",  syn: ["sitting", "sit", "sits", "seated"] },
  { name: "Running",  cat: "gen",  syn: ["running", "run", "runs"] },
  { name: "Eating",   cat: "gen",  syn: ["eating", "eat", "eats", "feeding", "feed"] },
  { name: "Drinking", cat: "gen",  syn: ["drinking", "drink", "drinks"] },
  { name: "Grooming", cat: "gen",  syn: ["grooming", "groom", "grooms"] },
  { name: "Preening", cat: "gen",  syn: ["preening", "preen", "preens"] },
  { name: "Env. Pecking",    cat: "gen", syn: ["environmental pecking", "environment pecking", "env pecking", "environmental peck", "environmental", "environment"] },
  { name: "Agr.Pecking",     cat: "gen", syn: ["aggressive pecking", "aggression pecking", "agr pecking", "agro pecking", "aggressive peck", "aggressive", "aggression", "agro"] },
  { name: "Feather Pecking", cat: "gen", syn: ["feather pecking", "feather peck", "feather pecks", "feather"] },
  { name: "Fighting", cat: "gen",  syn: ["fighting", "fight", "fights"] },
  { name: "Dust bathing", cat: "gen", syn: ["dust bathing", "dust bath", "dustbathing", "dust bathe", "bathing", "dustbath"] },
  { name: "Scratching", cat: "gen", syn: ["scratching", "scratches"] },
  { name: "Flapping", cat: "gen",  syn: ["flapping", "flap", "flaps"] },
  { name: "Stretching", cat: "gen", syn: ["stretching", "stretch", "stretches"] },
  { name: "Perching", cat: "gen",  syn: ["perching", "perch", "perches"] },
  { name: "Strutting", cat: "disp", syn: ["strutting", "strut", "struts"] },
  { name: "Tail fanning", cat: "disp", syn: ["tail fanning", "tail fan", "fanning", "tailfanning"] },
  { name: "Wing dragging", cat: "disp", syn: ["wing dragging", "wing drag", "dragging", "wingdragging"] },
  { name: "Gobbling", cat: "disp", syn: ["gobbling", "gobble", "gobbles"] },
  { name: "Other vocalisation", cat: "disp", syn: ["other vocalisation", "vocalisation", "vocalization", "vocalising", "vocalizing", "calling", "call", "vocalise"] },
];

/* Free-range-only extra behaviour: Foraging — ground/substrate-directed searching for food
 * (pecking + scratching at the pasture in search of food). Distinct from Eating (ingesting feed)
 * and Environmental Pecking (non-food object pecking); outdoor birds do it heavily, indoor birds
 * barely, so it is tracked for the free-range form ONLY. Appended AFTER the shared 22 so inside
 * grids/sheet columns keep their indices; free-range grids/sheets get this as a 23rd column. */
export const FORAGING: Behaviour = {
  name: "Foraging", cat: "gen", syn: ["foraging", "forage", "forages", "foraged"],
};
export const FREE_BEHAVIOURS: Behaviour[] = [...BEHAVIOURS, FORAGING];

/* Behaviour list for an animal space: inside = the shared 22; free-range = 22 + Foraging (23). */
export function behavioursFor(space?: string): Behaviour[] {
  return space === "free_range" ? FREE_BEHAVIOURS : BEHAVIOURS;
}

export const CELLS = ["K1", "K2", "K3", "K4", "K5", "K6", "K7", "K8"];
export const OBS = 6;

const NUM: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, a: 1, an: 1,
  // number-homophones Whisper commonly picks (two/to/too are acoustically identical)
  to: 2, too: 2, won: 1, for: 4, fore: 4, ate: 8,
};
// connector words to skip inside "make it / change to N" so "to" isn't read as 2 there
const NUM_CONNECTORS = ["to", "too", "for", "fore"];
const UNDO = ["cancel", "undo", "delete", "remove", "scratch", "nope", "no", "oops", "mistake", "forget", "ignore"];
// note: "to"/"for" removed from filler — they now count as number-homophones above
const FILLER = ["more", "and", "of", "the", "then", "plus", "times", "um", "uh", "er", "oh", "okay", "ok",
  "now", "so", "is", "was", "are", "wait", "let", "lets", "give", "got", "another", "also"];

const PHRASES: { words: string[]; beh: number }[] = [];
BEHAVIOURS.forEach((b, i) => b.syn.forEach((s) => PHRASES.push({ words: s.split(" "), beh: i })));
PHRASES.sort((a, b) => b.words.length - a.words.length);

export type Op =
  | { t: "add"; beh: number; n: number }
  | { t: "addLast"; n: number }
  | { t: "undo" }
  | { t: "setLast"; n: number }
  | { t: "cell"; cell: number }
  | { t: "next" };

/* Parse a transcript into ordered ops. Pure — no state, no side effects. */
export function parseToOps(text: string): Op[] {
  const t = (text || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!t) return [];
  const w = t.split(" ");
  const ops: Op[] = [];
  let i = 0;
  let pending: number | null = null;
  let justUndid = false;

  while (i < w.length) {
    const tok = w[i];

    if (UNDO.includes(tok)) {
      if (!justUndid) { ops.push({ t: "undo" }); justUndid = true; }
      pending = null; i++; continue;
    }
    if (["make", "change", "set", "correct"].includes(tok)) {
      let j = i + 1, n: number | null = null;
      while (j < Math.min(i + 4, w.length)) {
        const x = w[j];
        if (NUM_CONNECTORS.includes(x)) { j++; continue; } // "to" here is the connector, not 2
        if (x in NUM) { n = NUM[x]; break; }
        if (/^\d+$/.test(x)) { n = +x; break; }
        j++;
      }
      if (n != null) { ops.push({ t: "setLast", n }); i = j + 1; pending = null; justUndid = false; continue; }
      i++; continue;
    }
    if (["cell", "pen", "cage", "k"].includes(tok)) {
      const nxt = w[i + 1];
      const n = nxt in NUM ? NUM[nxt] : parseInt(nxt, 10);
      if (!isNaN(n) && n >= 1 && n <= CELLS.length) { ops.push({ t: "cell", cell: n - 1 }); i += 2; pending = null; justUndid = false; continue; }
    }
    const glue = tok.match(/^k([1-8])$/);
    if (glue) { ops.push({ t: "cell", cell: +glue[1] - 1 }); i++; pending = null; justUndid = false; continue; }
    if (tok === "next") { ops.push({ t: "next" }); i += w[i + 1] === "cell" ? 2 : 1; pending = null; justUndid = false; continue; }
    if (tok in NUM) { pending = NUM[tok]; i++; justUndid = false; continue; }
    if (/^\d+$/.test(tok)) { pending = parseInt(tok, 10); i++; justUndid = false; continue; }
    if (["that", "same", "it", "again"].includes(tok)) {
      if (justUndid) { i++; continue; }
      ops.push({ t: "addLast", n: pending ?? 1 }); pending = null; i++; continue;
    }
    if (FILLER.includes(tok)) { i++; continue; }

    let matched = false;
    for (const p of PHRASES) {
      if (p.words.every((pw, k) => w[i + k] === pw)) {
        ops.push({ t: "add", beh: p.beh, n: pending ?? 1 });
        pending = null; justUndid = false; i += p.words.length; matched = true; break;
      }
    }
    if (matched) continue;
    i++;
  }
  return ops;
}
