/* Data-driven glossary of known Whisper mistranscriptions → the intended word, applied as a
 * DETERMINISTIC pre-pass before the LLM (lib/ethogram/interpret.ts). This costs zero API tokens and
 * is 100% reliable for known cases, so the LLM prompt can stay short (kinder to the free tier /
 * context) — the prompt only carries GENERAL noise guidance; the explicit list lives here.
 *
 * Extend this from `/ethogram-audit` findings as new mishearings show up. ONLY put UNAMBIGUOUS
 * substitutions here — anything that could legitimately be two behaviours (e.g. "seating" =
 * sitting?/eating?, "peking" = pecking?/perching?, "stopping" = standing?, "pens" = perching?) is
 * deliberately LEFT OUT and handled by the model's judgement instead. */
export const MISHEARINGS: Record<string, string> = {
  // Perching (the roost count — by far the most-often garbled)
  petting: "perching", pettings: "perching",
  petching: "perching", petchings: "perching",
  patching: "perching", patchings: "perching",
  peching: "perching", percing: "perching", percings: "perching",
  peaching: "perching", spercing: "perching", purching: "perching",
  perishing: "perching", perishings: "perching",   // seen 2026-08-28
  // Pecking — only the tail word changes; any Environmental/Aggressive/Feather prefix is preserved
  packing: "pecking", packings: "pecking",
  // Foraging (free-range) — Whisper mangles it and the LLM otherwise mis-maps it to "Other
  // vocalisation". Single-token garbles (multi-word ones are in PHRASES below).
  oraging: "foraging", oragging: "foraging", voraging: "foraging", foraing: "foraging",
  oradzink: "foraging", oraying: "foraging",
  // Misc unambiguous
  gobling: "gobbling", goblings: "gobbling",
};

// Multi-word mishearings — replaced before the single-token pass (e.g. spoken "foraging" heard as
// two words when the leading "f" is dropped).
const PHRASES: Record<string, string> = {
  "floor aging": "foraging",
  "for aging": "foraging",
  // Perching heard as two words (2026-08-28) — the "pet …" family is unambiguous.
  "pet sings": "perching", "pet sing": "perching",
  "pet seats": "perching", "pet seat": "perching",
  "pet seeds": "perching", "pet sits": "perching",
};

const RE = new RegExp("\\b(" + Object.keys(MISHEARINGS).join("|") + ")\\b", "gi");

/* Replace known mishearings (case-insensitive, whole-word) with the intended word. Pure + free. */
export function normalizeMishearings(text: string): string {
  if (!text) return text;
  let t = text;
  for (const [k, v] of Object.entries(PHRASES)) t = t.replace(new RegExp("\\b" + k + "\\b", "gi"), v);
  return t.replace(RE, (m) => MISHEARINGS[m.toLowerCase()] ?? m);
}
