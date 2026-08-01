/* LLM interpretation of a transcript → per-behaviour counts for one clip.
 * Uses a Groq chat model with STRICT JSON-schema output (constrained decoding), so it can
 * handle phrasing variety, number-before-or-after, in-clip self-corrections, and Greek/English —
 * things the deterministic parser (lib/ethogram/parser.ts) can't. Returns null on any failure so
 * the caller can fall back to the deterministic parser. See ADR 0009. */
import { behavioursFor } from "./parser";

const MODEL = process.env.GROQ_LLM_MODEL || "openai/gpt-oss-20b";

/* Returns an array of length behavioursFor(space).length (count per behaviour for this clip), or
 * null on failure. `space` picks the behaviour set: free-range adds Foraging (see parser.ts). */
export async function interpretTranscript(text: string, space?: string): Promise<number[] | null> {
  const key = process.env.GROQ_API_KEY;
  if (!key || !text || !text.trim()) return null;

  const behaviours = behavioursFor(space);
  const NAMES = behaviours.map((b) => b.name);
  const SYSTEM = `You convert a poultry-ethology field researcher's spoken tally into structured counts.
During one short clip they say how many birds showed each behaviour. The ${NAMES.length} behaviours — use these EXACT names:
${NAMES.map((n, i) => `${i + 1}. ${n}`).join("\n")}

The audio is recorded in a NOISY barn/field and passed through speech-to-text, so words are often
MISHEARD as phonetically-similar non-behaviour words. Your job is to recover the INTENDED behaviour:
when a count sits next to a word that SOUNDS LIKE one of the behaviours above, map it to that behaviour.
- Perching is the most-often-garbled (it's usually the FIRST and LARGEST number in a clip — the roost
  count): "petting", "pettings", "petching", "patching", "peching", "percing(s)", "perches", "perts",
  "pets", "pens", "peeches", "spercing", "purging", "petti", "peaching" → Perching.
- "packing"/"peking"/"pacing" → Pecking — keep the prefix: Environmental / Aggressive / Feather Pecking.
- "shitting"/"seating"(when not clearly eating) → Sitting; "stopping"/"standin" → Standing;
  "gobling" → Gobbling; "forage"/"for aging" → Foraging (free-range).
- Homophone numbers: a bare "to"/"too" before a behaviour means 2, "for"/"fore" means 4
  (speech-to-text writes these for spoken "two"/"four"): "to environmental" = Environmental 2.
Prefer the closest behaviour in the list whenever a number + a near-homophone make the intent clear.

Other rules:
- A count may come BEFORE or AFTER the behaviour ("four running" / "running four" = Running 4).
- "N more X" ADDS to X. Honour self-corrections: "two, no three sitting" → Sitting = 3.
- The transcript may be English, Greek, or mixed (Greek "περισσότερα" = "more"); map Greek words/numbers.
- Do NOT invent counts from unintelligible gibberish: if a stretch is random word-salad from noise with
  no clear number+behaviour, SKIP it rather than guessing a behaviour.
- Only include behaviours actually counted, with n >= 1. If nothing countable was said, return empty.`;

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: text },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "ethogram_counts",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["counts"],
              properties: {
                counts: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    required: ["behaviour", "n"],
                    properties: {
                      behaviour: { type: "string", enum: NAMES },
                      n: { type: "integer", minimum: 1 },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!r.ok) return null;
    const d = await r.json();
    const content = d?.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as { counts?: { behaviour: string; n: number }[] };
    const arr = new Array(behaviours.length).fill(0);
    for (const c of parsed.counts ?? []) {
      const idx = NAMES.indexOf(c.behaviour);
      if (idx >= 0 && Number.isFinite(c.n) && c.n > 0) arr[idx] = Math.round(c.n);
    }
    return arr;
  } catch {
    return null;
  }
}
