# Architecture Decision Records — Ethogram feature

Lightweight ADRs (Context → Decision → Consequences) for the key choices behind `/ethogram`.
Newest decisions can be appended; don't rewrite history, add a superseding entry instead.

---

## ADR 0001 — Speech-to-text engine: Groq Whisper (not browser Web Speech)

**Status:** Accepted.

**Context.** First prototype used the browser's Web Speech API (free, built-in). On real,
accented, jargon-heavy, number-list speech it was badly inaccurate (mangled behaviour names and
digits). The tool must be free and run on a phone at the university.

**Decision.** Use **Groq's hosted Whisper** (`whisper-large-v3`) via a server route, primed with
the behaviour vocabulary. Free tier, no credit card, ~1–2s per clip, far better on accents/jargon.

**Consequences.** Requires a server endpoint holding `GROQ_API_KEY` (never in the client). Audio
leaves the device (acceptable — chicken-behaviour data). If the free tier ever tightens, the same
code swaps to another Whisper host (the request is standard). `whisper-large-v3` chosen over
`-turbo` for slightly better accuracy; both were verified to nail numbers on clean audio.

---

## ADR 0002 — Google Sheets via a service account, on a native Sheet

**Status:** Accepted.

**Context.** The master workbook lives in Google Sheets. The app (on Vercel) must write to it
autonomously. The workbook was originally an **uploaded `.xlsx`**.

**Decision.** Use a **service account** (GCP `ethogram-503119`) with the Sheet shared to its
`client_email`. Convert the master to a **native Google Sheet** (the Sheets API cannot add tabs
to an `.xlsx`). Credentials via `GOOGLE_CREDENTIALS` env (JSON string); target via `GSHEET_ID`.

**Consequences.** No OAuth/consent dance. **BUT a service account has no Drive storage**, so it
**cannot copy or create files** (`files.copy` → "quota exceeded"). Therefore no programmatic
backup copy is possible — see ADR 0005 for the safety model. The original `.xlsx` is kept as a
frozen backup.

---

## ADR 0003 — Number/word interpretation lives in the parser, not the model

**Status:** Accepted.

**Context.** Whisper returns homophones — "two" as `to`/`too`, "four" as `for`, etc. These are
**acoustically identical**; no model or prompt can reliably disambiguate them from a short clip.

**Decision.** Keep a **deterministic parser** we control (`lib/ethogram/parser.ts`) and map
number-homophones to digits there (`to/too→2, won→1, for/fore→4, ate→8`), with a connector-skip so
`change that to three` still works. The parser also handles streaming counts, "more", "that",
undo, and "make it N".

**Consequences.** Robust and instant; fixes are one line (add to the `NUM` map). New systematic
mishearings are handled by adding the exact wrong token, not by fighting the model.

---

## ADR 0004 — Dedicated full-screen `/ethogram` route (outside the dashboard)

**Status:** Accepted.

**Context.** The tool is used on a phone. The dashboard layout has a fixed 224px sidebar that
doesn't collapse, making the page unusable on mobile. Researchers also shouldn't see the other
(turkey) pages yet.

**Decision.** Put the page at its own route `app/ethogram/` with a **minimal layout** (no
sidebar), make it the **default landing** (root + post-login redirect), and remove the dashboard
link from its header. Other pages are **hidden, not deleted** (reach `/dashboard` by URL).

**Consequences.** Clean mobile UX; focused single-purpose page. Admin reaches the dashboard by
typing the URL. Re-exposing other pages later is just adding links back.

---

## ADR 0005 — Commits are additive and never overwrite (safety model)

**Status:** Accepted.

**Context.** Writing into the live research Sheet must not risk existing data, and (per ADR 0002)
automatic file backups aren't possible with a service account.

**Decision.** `commitDay` only ever **adds a new tab** and **refuses if a tab of that name already
exists** (`TabExistsError` → HTTP 409). Safety rests on: additive-only writes + Google Sheets'
built-in **version history** + the frozen `.xlsx` original.

**Consequences.** A bad commit can at worst add one extra tab (easily deleted); it can never
overwrite or delete existing data. To re-commit a day, the old tab must be renamed/deleted first.
An explicit "update existing tab" mode would be a deliberate future decision, not a default.

---

## ADR 0006 — Supabase persistence: draft autosave + transcript audit; Sheets stays the record

**Status:** Accepted (implemented 2026-07-22 — the first production writes this project ever stored).

**Context.** Until now the whole session lived only in React state (`EthogramClient` reducer): a
phone refresh, tab close, or crash mid-session lost everything, and each clip's transcript was
discarded the instant it was parsed. We wanted durability (crash-recovery/resume) and a scientific
audit trail (what was actually said per cell), on the **free** Supabase tier.

**Decision.** Add two tables (see `supabase/schema.sql`), keeping **Google Sheets as the system of
record** — Supabase is the safety net + memory, not the source of truth:
- `ethogram_sessions` — one row per `(user_id, session_date, time_of_day)` (natural key = the Sheet
  tab name `D-M Π/Μ`). The 48×22 grid is stored as a **JSONB `data` column** (mirrors the in-memory
  `number[][][]`), **autosaved (debounced ~1.5s)** on every change via `POST /api/ethogram/session`.
  `GET` resumes it. Commit sets `status='committed'`, `sheet_tab`, `committed_by`, `committed_at`.
- `ethogram_recordings` — append-only transcript log (`obs`, `cell`, `transcript`) via
  `POST /api/ethogram/recording`; returned with the session on resume and shown per cell (latest wins).
- **Ownership-based RLS** (`user_id = <clerk sub>`; admins may read all). Deliberately **not**
  gated on the `researcher`/`admin` role or `allowed_locations` — ethogram is decoupled from the
  turkey location model, and `profiles` is empty so role helpers evaluate false for everyone.
- **Committer visibility:** commit writes an **A1 cell note** ("Committed by <name> (<email>) · <ts>",
  name resolved from Clerk) — chosen over a header/footer row so the strict 48-row grid is untouched.
- **"Clear whole day"** deletes the session (cascades to recordings) but **never touches the Sheet**
  (consistent with ADR 0005 — the app never deletes Sheet data; deleting a committed tab stays manual).

**Why JSONB over normalized per-cell rows.** The grid is really one document per session, edited by
one person, exported as a unit. JSONB makes autosave a one-line upsert and matches the client shape
exactly. Cross-session SQL analysis (if ever needed) can flatten at commit time or be done in Sheets.

**Why the free tier is safe.** ~200 sessions/year × ~15 KB (grid + transcripts) ≈ **~4 MB/year** vs
the 500 MB free DB. The only thing that would blow it is storing **audio** — so we don't; audio is
still discarded after transcription. Watch the free-tier **7-day inactivity pause** (an availability
quirk, not a capacity one).

**Consequences.** A refresh/crash no longer loses work; transcripts are preserved for verification
and re-parsing. Note the date picker **resets to today on load** (sensible default) — resuming a
different day means reselecting its date + AM/PM. Autosave skips a fully-empty grid (no empty rows).
The commit's session-status update and the transcript save are **best-effort** (a failure never
blocks the commit or the UI) since the Sheet remains authoritative.

---

## ADR 0007 — Re-commit policy: guarded in-app Replace for app-owned tabs; never touch foreign tabs

**Status:** Accepted (implemented 2026-07-22). Extends ADR 0005 (additive-only) rather than replacing it.

**Context.** ADR 0005 makes commits additive: a tab-name collision throws `TabExistsError` (409) and
the user must delete/rename the tab in Sheets to re-commit. That's safe but friction-heavy for the
common correction case ("I committed a day, spotted a mistake, want to re-push"). We want an in-app
correction path **without** risking a sheet the app didn't create (a manually-made or pre-existing tab
that happens to share the `D-M Π/Μ` name).

**Decision.** Additive-only stays the **default**. Add one **guarded overwrite** path:
- The default `Commit` still calls `commitDay` → refuses on any name collision. On a `TAB_EXISTS`
  response the client offers a **Replace** button *only if this session's status is `committed`*
  (i.e. the app itself committed this day); otherwise it just tells the user to rename/delete in Sheets.
- `Replace` posts `{replace:true}`. The server **verifies ownership against Supabase** (a `committed`
  `ethogram_sessions` row for this user+date+AM/PM whose `sheet_tab` matches) — client claims are not
  trusted. If not owned → `409 NOT_APP_OWNED`, refuse.
- `replaceTab` then applies a **second, independent guard**: it reads the target tab's `A1` and only
  overwrites if it equals `"OBSERV."` (looks like our template); otherwise `409 TAB_SHAPE_MISMATCH`.
  It clears the tab's range and rewrites the 48 rows + refreshes the A1 note ("Re-committed by …").
- **Undo safety net = Google Sheets version history** (consistent with ADR 0005; the app still never
  *deletes* a tab).
- **Badge reconciliation:** on resume, a `committed` session whose `sheet_tab` no longer exists in the
  Sheet is quietly reverted to `draft` (best-effort, committed-sessions only) so the badge can't lie
  and a fresh commit is allowed again.
- **Future-date guard:** a soft amber warning when the picked date is after today (typo catch). Past
  dates stay fully allowed (back-filling a missed observation day is legitimate).

**Consequences.** Two independent checks (Supabase ownership + A1 shape) must both pass before any
overwrite, so a foreign/manual tab is never clobbered from the app. The correction workflow is now
in-app. The Sheet remains the system of record and the authority on whether a commit can proceed;
Supabase only *gates the Replace offer*. `values.clear` covers `A1:Z100`, so a replaced tab can't keep
stale cells beyond the 49×~25 grid.
