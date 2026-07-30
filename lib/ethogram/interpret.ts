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

Rules:
- The transcript may be English, Greek, or mixed. Map Greek behaviour words and Greek numbers to the list.
- A count may come BEFORE or AFTER the behaviour ("four running" and "running four" both mean Running = 4).
- Honour self-corrections: "two, no three sitting" → Sitting = 3.
- Ignore filler and anything not in the list. Only include behaviours actually counted, with n >= 1.
- If nothing countable was said, return an empty list.`;

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
