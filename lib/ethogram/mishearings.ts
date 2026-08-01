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
  // Pecking — only the tail word changes; any Environmental/Aggressive/Feather prefix is preserved
  packing: "pecking", packings: "pecking",
  // Misc unambiguous
  gobling: "gobbling", goblings: "gobbling",
};

const RE = new RegExp("\\b(" + Object.keys(MISHEARINGS).join("|") + ")\\b", "gi");

/* Replace known mishearings (case-insensitive, whole-word) with the intended word. Pure + free. */
export function normalizeMishearings(text: string): string {
  if (!text) return text;
  return text.replace(RE, (m) => MISHEARINGS[m.toLowerCase()] ?? m);
}
