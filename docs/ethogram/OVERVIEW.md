# Ethogram Voice — feature overview

Voice-driven data entry for Grigoria's PhD ethology study. She observes chicken pens and
scores behaviour counts; this feature lets her **dictate** the tallies on her phone instead of
writing on paper and hand-copying into a spreadsheet. Speech → transcript → an on-screen grid →
a new tab committed to the master Google Sheet.

Route: **`/ethogram`** (its own full-screen, Clerk-protected page — deliberately outside the
`(dashboard)` layout so there's no sidebar on mobile). It is the **default landing page**.

---

## 1. Background — how this came to exist

This repo (`AnimalMonitoring`, the "turkey dashboard") already existed: Next.js 16 + Clerk +
Supabase + Vercel, with pages for locations, barn, daily temps, feed, tasks, stats, admin.

The ethogram tool was **added on top** of that app. It started life as a standalone prototype
(a plain Node server + a single HTML page, still at `…/etho-voice/` on the original dev machine)
used to prove two risky things cheaply:
1. that browser speech recognition was **not** good enough (Google's Web Speech API mangled
   accented, jargon-heavy, number-list speech), and
2. that **Groq Whisper** + a deterministic parser **was** good enough.

Once proven, the whole thing was ported into this app as an isolated feature (new files only,
plus one nav link). The standalone version is superseded but was kept as a quick offline test
harness. See the ADRs in `docs/adr/` for the decisions made along the way.

---

## 2. The data model (matches the Sheet exactly)

One **session** = one day + one time-of-day (Πρωί/morning `Π` or Μεσημέρι/lunch `Μ`) = **one
tab** in the Google Sheet, named like `10-7 Π`. A session is **twice a day, ~2 days/week**.

Each tab is **48 rows**: an `OBSERV.` column running **1→6**, and under each observation all
**8 cells** `K1…K8`. Columns are `OBSERV. | Cell | <22 behaviours> | Σ`.

```
OBSERV 1 → K1 K2 K3 K4 K5 K6 K7 K8
OBSERV 2 → K1 … K8
…
OBSERV 6 → K1 … K8      (48 data rows + a trailing per-row Σ total)
```

**Recording unit = one clip per (observation, cell)** → up to 48 short recordings per session.

The 22 behaviours (July template `10-7`, in column order) live in
[`lib/ethogram/parser.ts`](../../lib/ethogram/parser.ts): Walking, Standing, Sitting, Running,
Eating, Drinking, Grooming, Preening, Env. Pecking, Agr.Pecking, Feather Pecking, Fighting,
Dust bathing, Scratching, Flapping, Stretching, Perching, Strutting, Tail fanning, Wing dragging,
Gobbling, Other vocalisation. (An earlier May template had only 18 — we target July.)

---

## 3. Architecture / file map

All additive — nothing in the existing app was rewritten except one Sidebar nav link.

| File | Role |
|---|---|
| `lib/ethogram/parser.ts` | Pure, framework-free parser. `parseToOps(text)` → list of ops (add / addLast / undo / setLast / cell / next). Also exports `BEHAVIOURS`, `CELLS`, `OBS`. Now the **fallback** parser (ADR 0009). |
| `lib/ethogram/interpret.ts` | **Primary** transcript→counts: `interpretTranscript(text)` calls a Groq chat model with strict JSON-schema output → per-behaviour counts. Handles phrasing variety + number-before/after + self-corrections + **Greek/English**. Returns null on failure → caller falls back to `parseToOps` (ADR 0009). |
| `lib/ethogram/sheets.ts` | `commitDay(…, note?)` adds a new tab (**throws `TabExistsError` (409) rather than overwrite**; optional A1 `note`). `replaceTab(…)` overwrites an existing app-owned tab (guard: A1 must be `"OBSERV."`, else `TabShapeError`; falls back to create if the tab vanished). `tabExists(…)` checks a tab name. Creds from `GOOGLE_CREDENTIALS`. |
| `app/api/ethogram/transcribe/route.ts` | Clerk-guarded. POST audio → Groq Whisper (auto-detect lang) → `interpretTranscript` → `{text, counts}`. `runtime = "nodejs"`. |
| `app/api/ethogram/interpret/route.ts` | Clerk-guarded. POST `{text}` → `{counts}` via the LLM. Standalone for testing (no mic) + re-parsing stored transcripts. |
| `app/api/ethogram/commit/route.ts` | Clerk-guarded. POST `{tabName, rows, sessionDate, timeOfDay, replace?}`. Default → `commitDay` (additive). `replace:true` → verifies the session is app-`committed` (Supabase) then `replaceTab`; refuses foreign tabs (`NOT_APP_OWNED`). Writes committer A1 note + marks session `committed`. |
| `app/api/ethogram/session/route.ts` | Clerk-guarded. `POST` autosaves the working grid (upsert on the natural key); `GET ?date=&ampm=` resumes it **plus its transcripts**, and **reconciles** a stale `committed` badge (reverts to `draft` if its tab no longer exists in the Sheet); `DELETE` clears a whole day (session + recordings; never touches the Sheet). |
| `app/api/ethogram/recording/route.ts` | Clerk-guarded. `POST {date, ampm, obs, cell, transcript}` appends a transcript to `ethogram_recordings` (audit trail). |
| `app/api/ethogram/sessions/route.ts` | Clerk-guarded. `GET` lists the caller's saved sessions (most recent first, + filled-cell count) for the past-sessions browser. |
| `app/ethogram/page.tsx` | Server component; reads env to decide `commitEnabled`. |
| `app/ethogram/EthogramClient.tsx` | The whole UI: reducer over `data[obs][cell][behaviour]`, MediaRecorder, timer, grid, export/commit. **Debounced autosave + resume + per-cell transcript display + Inside/Free-range space selector** (ADR 0008; cell count is data-driven — inside 8, free-range 1). `"use client"`. |

**Persistence tables** (see `supabase/schema.sql`, ADR 0006): `ethogram_sessions` (JSONB grid,
autosaved; natural key `user_id + session_date + time_of_day`) and `ethogram_recordings` (append-only
transcript log). Ownership-based RLS. **Google Sheets stays the system of record**; Supabase is the
crash-recovery safety net + audit trail.
| `app/ethogram/layout.tsx` | Minimal full-screen layout (no dashboard sidebar). |
| `app/page.tsx`, `app/(auth)/sign-in|sign-up` | Redirect `/` and post-login to `/ethogram`. |
| `components/Sidebar.tsx` | One nav link to `/ethogram` (only seen if you open `/dashboard`). |

---

## 4. How it works end-to-end

1. Pick **observation (1–6)** + **cell (K1–K8)**.
2. **Record** → MediaRecorder captures audio (`audio/webm` on Android, `audio/mp4` on iOS Safari).
   A **count-up timer** shows elapsed time; at **1:00** it turns amber and the phone vibrates
   (Android) so she can keep her eyes on the pen. **Cancel** discards a take without transcribing.
3. **Stop** → audio POSTed to `/api/ethogram/transcribe` → Groq Whisper → transcript.
4. The transcript → **LLM** (`interpretTranscript`, Groq, strict JSON) → per-behaviour counts set on
   the cell (falls back to the deterministic `parseToOps` if the LLM fails). Handles English/Greek,
   number order, and self-corrections (ADR 0009). The transcript is shown so she can verify;
   **＋/−** buttons fix anything by hand.
5. **Redo semantics**: for a filled cell the primary button becomes **Next ▸** and re-recording is a
   small secondary **↻ Redo** (with a confirm) that clears the cell first — a second pass **replaces**,
   never accumulates. (Slow fetches show a spinner; commit/replace show an in-button spinner.)
6. **Next ▸** walks K1→K8, then rolls into the next observation.
7. **Autosave (Supabase):** every grid change is debounced (~1.5s) and upserted to
   `ethogram_sessions`; each transcript is appended to `ethogram_recordings`. The header shows
   `saving… / saved ✓` (or `✓ committed`, or amber `✎ edited since commit` once a committed day is
   edited again — ADR 0007). A refresh/crash loses nothing — reselect the same date + AM/PM to **resume**
   (grid + per-cell transcripts reload). The date picker **resets to today on load** by design.
8. **Commit** → `/api/ethogram/commit` → a new `D-M Π/Μ` tab with all 48 rows, an **A1 note** naming
   who committed, and the session marked `committed`. Or **Copy for Excel** for a manual paste.
   A day already **committed** shows **♻ Replace** as its primary button (guarded overwrite, warns on
   click; ADR 0007) instead of Commit. A first commit that collides with a **foreign/manual** tab is
   refused (rename/delete it in Sheets first).
9. **Clear whole day** wipes the grid and deletes the saved session (+ its transcripts). It **never
   touches Google Sheets** — deleting an already-committed tab stays a manual step in Sheets.

### Speech the parser understands
- Counting: `three sitting`, `two more eating`, `one drinking`.
- Repeat last: `two that`, `three same`.
- Undo: `cancel` / `no` / `scratch that` / `oops` (consecutive undo words collapse to one).
- Fix count: `make it three`, `change that to two`.
- Switch cell: `cell four`, `K six`, `next cell`.
- **Number homophones** (Whisper can't tell these apart acoustically, so the *parser* maps them):
  `to`/`too`→2, `won`→1, `for`/`fore`→4, `ate`→8. Add new ones to the `NUM` map if they appear.

---

## 5. Google Sheets integration

- The master must be a **native Google Sheet**, NOT an uploaded `.xlsx` — the Sheets API cannot
  add tabs to an `.xlsx`. (The original `.xlsx` was converted once via File → Save as Google
  Sheets and is kept as a frozen backup.)
- Access is via a **service account** (GCP project `ethogram-503119`); the Sheet is shared with
  its `client_email` as Editor. Credentials are the full service-account JSON, provided as the
  `GOOGLE_CREDENTIALS` env var on Vercel (and, for local dev, `service-account.json` — git-ignored).
- Target sheet id is the `GSHEET_ID` env var.
- **Safety model:** a service account has *no Drive storage*, so it **cannot copy files** — there
  is no automatic backup copy. Instead safety = (a) commits are **additive and never overwrite**
  (refuse if the tab exists) and (b) Google Sheets' built-in **version history**. See
  `docs/adr/0002` and `0005`.

---

## 6. Environment variables

Set on **Vercel** (Production) and, for local dev, in `.env.local`:

| Var | Purpose |
|---|---|
| `GROQ_API_KEY` | Groq Whisper transcription (free tier). |
| `GSHEET_ID` | Id of the native master Google Sheet. |
| `GOOGLE_CREDENTIALS` | Full contents of the service-account JSON (one string). |
| `GSHEET_ID_FREERANGE` | Id of the free-range/outside master Sheet (second animal space; ADR 0008). |
| `GROQ_MODEL` | Optional; Whisper model, defaults to `whisper-large-v3`. |
| `GROQ_LLM_MODEL` | Optional; chat model for transcript→counts, defaults to `openai/gpt-oss-20b` (ADR 0009). |

(Plus the app's existing Clerk/Supabase vars.)

---

## 7. Deployment

Every `git push` to `master` auto-deploys via Vercel. **Run `npm run build` locally first.**
Live at https://animal-monitoring.vercel.app/ethogram (Clerk login required; mic needs https,
which Vercel provides).

---

## 8. MCP servers (for Claude agents working on this repo)

Two ways to wire these up, by frontend:

**A. App chats** (claude.ai / desktop app) → **Settings → Connectors** (account-level). The
catalog lists Vercel, Supabase, Clerk as hosted/remote connectors; connect them there and they
appear in your **next** app chat. Managed org (Team/Enterprise) accounts may need admin approval.

**B. Terminal `claude` in this repo** → the repo's `.mcp.json`. Copy
[`.mcp.json.example`](../../.mcp.json.example) to `.mcp.json` (git-ignored), paste a Supabase
token, then run `claude` from a terminal:
- **supabase** — LOCAL npx server (terminal-only), read-write, scoped to project
  `gtbyspehkcdypuioivha`. Token from supabase.com/dashboard/account/tokens.
- **vercel** — remote (HTTP), OAuth on first use (`/mcp`). Deploy status / logs / env.
- **clerk** — remote (HTTP), OAuth. Clerk SDK snippets & auth patterns.

Rules of thumb: **remote** servers (vercel, clerk, and a *hosted* Supabase) work in **both** A and
B; a **local stdio** server (the `npx` Supabase here) only works in a **terminal**. MCP config is
read at **session start** — a newly added server shows up only in the next session, not mid-chat.

Windows note: if the Supabase `npx` server fails to start, try `"command": "cmd"`,
`"args": ["/c", "npx", …]`.

---

## 9. Known limitations & lessons

- Transcription accuracy depends on **audio quality** — speak clearly/close; Bluetooth headsets
  drop to low-quality "hands-free" mic mode. The Groq engine itself is solid (verified on clean
  audio); most errors are mic/environment or homophones (handled in the parser).
- One recording = one cell. Within a clip she can say as much as she likes; a *second* clip is a
  Redo (replace), not an append.
- **Clip size / "too long":** a single audio POST must stay under Vercel's ~4.5MB request-body
  cap, else the platform rejects it before our code runs (surfaces as a "too long"-style error).
  Mitigations: the recorder caps audio at **48kbps** (`audioBitsPerSecond`; ~0.5MB per 80s, only a
  hint — falls back to the browser default if unsupported), and `transcribe` runs with
  `maxDuration = 60` and logs the exact Groq failure for diagnosis. Whisper downsamples to 16kHz
  mono, so 48kbps is transparent for speech.
- The 2nd ethogram form type (mentioned but never seen) is **not** implemented.

---

## 10. Open items

- Broader end-to-end verification of every commit action + state handling.
- ~~Supabase-backed session history / audit trail~~ — **done** (ADR 0006): drafts autosave/resume
  and transcripts are persisted.
- ~~Past-sessions browser~~ — **done**: `GET /api/ethogram/sessions` + a collapsible list in the UI
  (🗂 Past sessions) that reopens any prior day. Resuming by reselecting a date + AM/PM still works too.
- **Security hardening (pre-existing, unrelated to ethogram):** mostly done.
  - `search_path` pinned + refs schema-qualified on the 4 SQL helpers (migration `harden_helper_search_path`).
  - Those 4 helpers are now revoked from `anon`/`PUBLIC` and granted only to `authenticated` +
    `service_role` (migrations `harden_helper_execute_grants`, `harden_helper_revoke_anon_direct`) —
    verified via `has_function_privilege` (anon=false, authenticated=true). This clears the `anon`
    RPC-executable advisor. Note: Supabase grants these roles EXECUTE **directly**, so `REVOKE … FROM
    PUBLIC` alone isn't enough — you must also `REVOKE … FROM anon`.
  - Still open (by design / low priority): the `authenticated` RPC-executable warning remains — logged-in
    users must keep EXECUTE because the RLS policies call these. And `rls_auto_enable` (an event-trigger
    fn we didn't author) is still `anon`-executable and left untouched.
- Optional: remember the last-used date/AM-PM (localStorage) so a refresh reopens the active session
  instead of defaulting to today.
- **E2E tests (deferred idea, not built):** a Playwright harness for headless auto-login testing —
  auth via `@clerk/testing` testing tokens, and **mock `/api/ethogram/transcribe`** to inject
  transcripts so the full pipeline (parse → grid → autosave → resume) can be tested without a mic.
  Ad-hoc verification meanwhile uses Claude-in-Chrome (drives the user's visible, logged-in browser).
- The 2nd form type, when provided.
