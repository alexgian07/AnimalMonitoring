# AnimalMonitoring — Ethogram Voice + Research Dashboard

A poultry-ethology research tool. Its centrepiece is **Ethogram Voice** (`/ethogram`): a researcher
**dictates** behaviour tallies on a phone while watching a pen → the speech is transcribed and turned
into structured counts → committed as a tidy tab in a master **Google Sheet**. It grew on top of an
existing animal-monitoring dashboard (locations, weights, feed, tasks, stats).

**Live:** https://animal-monitoring.vercel.app

---

## Why it exists

Scoring animal behaviour by hand (paper → spreadsheet) is slow and error-prone in the field. This
lets an observer keep their eyes on the animals and just **talk**: "four running, three sitting…"
(English **or Greek**), and the counts fill in on screen for a quick visual check before saving.

## Stack

| Concern | Tech |
|---|---|
| Framework | **Next.js 16** (App Router) + React 19, TypeScript, Tailwind |
| Auth | **Clerk** (third-party auth → Supabase; no JWT template) |
| Database | **Supabase** (Postgres + Row-Level Security) |
| Speech → text | **Groq Whisper** (`whisper-large-v3`) |
| Text → counts | **Groq** chat model (strict JSON schema) — LLM parsing, with a deterministic fallback |
| Spreadsheet | **Google Sheets API** via a service account |
| Hosting / CI | **Vercel** (push to `master` auto-deploys) |

## How the ethogram flow works

1. Pick an observation (+ cell, for the "inside" space) and **record**.
2. Audio → `Groq Whisper` → transcript (language auto-detected: English/Greek).
3. Transcript → **LLM** (`lib/ethogram/interpret.ts`, Groq, strict JSON) → per-behaviour counts.
   Handles number-before/after, phrasing variety, in-clip self-corrections, and Greek. Falls back to
   a deterministic parser (`lib/ethogram/parser.ts`) if the LLM call fails.
4. Counts fill the grid; the transcript is shown for verification; **＋/−** fix anything by hand.
5. Everything **autosaves** to Supabase (crash-safe resume); each transcript is kept as an audit trail.
6. **Commit** → a new tab in the Google Sheet. Two "spaces" are supported: **Inside** (6 obs × 8
   cells, one tab per half-day) and **Free-range** (per-observation, one tab per day).

## Key design notes

- **Google Sheets is the system of record**; Supabase is the crash-recovery net + audit trail.
- Commits are **additive by default** (never overwrite a tab); the exceptions are a *guarded* replace
  (inside) and an upsert for the app's own day-tab (free-range) — never a tab the app didn't create.
- Full architecture, data model, and rationale: [`docs/ethogram/OVERVIEW.md`](docs/ethogram/OVERVIEW.md)
  and the decision records in [`docs/adr/DECISIONS.md`](docs/adr/DECISIONS.md).
- DB schema (single source of truth): [`supabase/schema.sql`](supabase/schema.sql).

## Local development

```bash
npm install
npm run dev      # http://localhost:3000  (ethogram is the default landing page)
npm run build    # run before pushing — every push to master auto-deploys via Vercel
```

Create a `.env.local` (git-ignored) with:

```bash
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=...
CLERK_SECRET_KEY=...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...

# Groq (Whisper + LLM parsing)
GROQ_API_KEY=...
# GROQ_MODEL=whisper-large-v3        # optional
# GROQ_LLM_MODEL=openai/gpt-oss-20b  # optional

# Google Sheets (service-account JSON as a single string)
GOOGLE_CREDENTIALS={...}
GSHEET_ID=...                        # inside master sheet id
GSHEET_ID_FREERANGE=...              # free-range master sheet id
```

The master Google Sheet must be a **native** Google Sheet (not an uploaded `.xlsx`) and shared with
the service account's `client_email` as Editor. Apply `supabase/schema.sql` to your Supabase project.

## Notes

Personal research project, not affiliated with any organisation. Contributions welcome via pull
request — the repo is read-only to non-collaborators.
