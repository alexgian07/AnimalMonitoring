---
name: ethogram-audit
description: Cross-validate an ethogram day's raw transcripts against the stored counts for BOTH spaces (inside + free-range), report discrepancies ranked by confidence, and — only on explicit confirmation — apply targeted DB fixes without clobbering manual edits. Use when asked to audit / verify / cross-check / "look over" ethogram data for a date, or to find dropped counts.
---

# Ethogram audit — transcript ↔ stored-counts cross-check

Codifies the manual cross-validation that surfaced the free-range **Foraging** gap and the obs3
**Environmental Pecking** drop (see ADR 0010). Given a date, it checks **both spaces and both halves**,
reports mismatches, and can apply safe DB fixes. Read this whole file before acting.

## Inputs
- **date** (required). Accept `YYYY-MM-DD` or `D-M` (e.g. `30-7` → resolve to the current year).
  If not supplied, ask for it — do not guess.
- **spaces** (optional): default **both** `inside` and `free_range`.

## Data model (must be exact)
- Sessions: `ethogram_sessions` — natural key `(user_id, session_date, time_of_day, space)`.
  `time_of_day` ∈ {`Π` (morning), `Μ` (lunch/afternoon)}. `space` ∈ {`inside`, `free_range`}.
  `data` = jsonb grid `[obs][cell][behaviour]`. Inside = 6 obs × 8 cells; free-range = 6 obs × 1 cell.
- Transcripts: `ethogram_recordings (session_id, obs, cell, transcript, created_at)`. `obs`/`cell` are
  **1-based** here; grid indices are 0-based (subtract 1).
- **Behaviour index order** (from `lib/ethogram/parser.ts` — re-read it to confirm before a run):
  `0 Walking, 1 Standing, 2 Sitting, 3 Running, 4 Eating, 5 Drinking, 6 Grooming, 7 Preening,
  8 Env. Pecking, 9 Agr. Pecking, 10 Feather Pecking, 11 Fighting, 12 Dust bathing, 13 Scratching,
  14 Flapping, 15 Stretching, 16 Perching, 17 Strutting, 18 Tail fanning, 19 Wing dragging,
  20 Gobbling, 21 Other vocalisation`. **Free-range only** adds `22 Foraging`.
  Inside grids are length **22**, free-range length **23**. If parser.ts has changed, use its order.

## Safety preflight (always, before any check)
1. This audit is **read-mostly**. Read-only `SELECT`s never block her writes (Postgres MVCC) — safe to
   run anytime, including while she records.
2. **Never `git push` / redeploy during active use** — that risks an app rebuild mid-session. Code
   changes from an audit (e.g. a genuinely missing behaviour) are drafted locally and pushed only when
   she is idle.
3. Before proposing a *write*, check whether the target session is an **active draft**:
   `status='draft'` with a recent `updated_at` (last ~10 min). If so, it's being edited **right now** —
   do not modify it; report and defer, or ask. Prefer to only fix **committed** or clearly-idle sessions
   (today's fix worked precisely because it touched the committed morning, not the live lunch).

## Step 1 — Pull the day (per space, both halves)
```sql
-- sessions
SELECT id, time_of_day, space, status, sheet_tab, committed_by_name, updated_at, committed_at,
       jsonb_array_length(data->0->0) AS beh_len, data
FROM ethogram_sessions
WHERE session_date = :date AND space = :space
ORDER BY time_of_day;
-- transcripts for a session
SELECT obs, cell, transcript, created_at
FROM ethogram_recordings WHERE session_id = :id
ORDER BY obs, cell, created_at;   -- later takes win if a cell was re-recorded
```

## Step 2 — Cross-validate each cell
For every `(obs, cell)` that has a transcript, compute the **expected** per-behaviour counts by reading
the transcript, then diff against `data[obs-1][cell-1]`. When reading transcripts, handle what the LLM
handles: count **before or after** the word; **"N more X"** accumulates; Greek **"περισσότερα"** = "more";
Greek behaviour/number words; **self-corrections** ("two, no three sitting" → 3). Also account for
common **Whisper artifacts** so they aren't miscounted:
- Mis-hearings: *perting / pertsing / perts / petti / petting / purging* → **Perching**;
  *Packing / Peking* → **Pecking** (with its prefix: env/aggressive/feather);
  *Gobling* → **Gobbling**; *forage/foraging* → **Foraging** (free-range only).
- **Homophone numbers**: Whisper may write *"to"* for 2 and *"for"* for 4 (e.g. *"to environmental"*,
  *"for grooming"*). The LLM currently treats these as filler and undercounts — flag them.
- **Hallucinated tails** (garbled trailing phrases like *"Re-hotting"*, *"Υπότιτλοι AUTHORWAVE"*,
  Romanian/other-language junk) carry no numbers and should be ignored — confirm they added nothing.

## Step 3 — Classify each discrepancy
- **DROPPED (high confidence)** — a behaviour clearly counted in the transcript but stored **0** (or far
  lower). This is the safe-to-fix class (the Foraging / obs3-Env case).
- **UNMAPPABLE (structural)** — a behaviour word said repeatedly that isn't in the space's list at all
  (how Foraging was found). **Do not DB-fix.** Surface it as a possible **missing category** and ask the
  researcher whether it's a real behaviour to add to the code (free-range vs inside).
- **MISMATCH (low confidence)** — small/ambiguous differences (off-by-one, homophone undercounts). These
  may be her deliberate ＋/− edits. **Report, do not auto-fix.**

## Step 4 — Report
Per space, a compact table: `obs·cell | behaviour | said | stored | class`. Give per-space totals
("≈N birds potentially dropped"). Lead with DROPPED and UNMAPPABLE. Be explicit that **stored counts may
include her manual corrections**, so a diff is a prompt for review, not proof of error.

## Step 5 — Fixes (ONLY on explicit confirmation)
- Fix **only** confirmed DROPPED items. **Never** overwrite a whole cell/grid — use targeted `jsonb_set`
  per `{obs,cell,beh}` path so every other value and any manual edits are preserved:
```sql
UPDATE ethogram_sessions
SET data = jsonb_set(data, '{<obs0>,<cell0>,<beh>}', to_jsonb(<value>::int))
WHERE id = :id
RETURNING (data->:obs0->:cell0->>:beh) AS new_val;   -- verify
```
- Before writing, re-confirm the current value is the wrong one you expect (usually `0`), not something
  she since edited. Do **not** touch `updated_at`/`committed_at` — leaving them avoids tripping the
  client's "✎ edited since commit" flag and keeps the row looking untouched (as intended).
- Batch related fixes; RETURNING-verify each.

## Step 6 — Sheet reconciliation (important)
A DB fix does **not** update the Google Sheet. The tab only changes on a **re-commit, which is
owner-only** (the researcher's own Clerk account) — you cannot push to the Sheet for her.
- Tell the user exactly which day tab(s) need re-committing, and by whom.
- **Free-range**: one re-commit of the day rewrites **both** halves (morning read from DB + the
  committing half) — so a single commit reflects all DB fixes for that day.
- **Inside**: re-commit is **per half** (guarded `replaceTab`, owner-only) — each fixed half must be
  re-committed. If a day isn't committed yet, no re-commit is needed; the fix is already in the draft.

## Optional — validate a suspected LLM miss
To test whether adding a category (or clearer audio) would fix a miss, the transcript can be re-run
through the interpreter (`POST /api/ethogram/interpret {text, space}` → `{counts}`) and compared. This
calls Groq but writes nothing. It needs an authenticated app session, so it's usually a manual check.
