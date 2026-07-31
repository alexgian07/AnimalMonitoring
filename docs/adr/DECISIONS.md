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

**Update (2026-07-23) — flush-on-switch:** the debounced autosave was being *cancelled* if the user
switched date/AM-PM/space (or left the page) within the ~1.5s debounce window, silently dropping
those edits (most visible toggling free-range morning↔lunch, and it made day-tab commits write stale
data for the sibling half). Fixed: the latest unsaved payload is kept in a ref and **flushed
immediately** on session-identity change / unmount, so edits are saved to the session being left.

**Update (2026-07-30) — team visibility:** the study has ~5 researchers sharing the Sheets, so the
original ownership-only read was widened: **any signed-in user can read COMMITTED sessions (and their
transcripts); drafts stay private to their owner; writes remain owner-only.** RLS is gated on a present
Clerk `sub` so the public anon key reads nothing (sign-up is Restricted → only the researchers).
Sessions store `committed_by_name` (resolved from Clerk at commit); the UI shows a **"committed by
&lt;name&gt;" banner** when another researcher already committed the open day/slot, and the
past-sessions list is **team-wide** (everyone's committed days, each labelled with who did it) plus
your own drafts. The Sheet's additive/guarded commit already prevents overwriting a peer's tab; this
adds the *awareness*. (Note: the app grid still loads *your* session — to view a peer's actual counts,
open the Sheet; an in-app read-only peer view would be a further step.)

---

## ADR 0007 — Re-commit policy: guarded in-app Replace for app-owned tabs; never touch foreign tabs

**Status:** Accepted (implemented 2026-07-22). Extends ADR 0005 (additive-only) rather than replacing it.

**Context.** ADR 0005 makes commits additive: a tab-name collision throws `TabExistsError` (409) and
the user must delete/rename the tab in Sheets to re-commit. That's safe but friction-heavy for the
common correction case ("I committed a day, spotted a mistake, want to re-push"). We want an in-app
correction path **without** risking a sheet the app didn't create (a manually-made or pre-existing tab
that happens to share the `D-M Π/Μ` name).

**Decision.** Additive-only stays the **default**. Add one **guarded overwrite** path:
- A day already marked `committed` shows **Replace** as its primary action button (in place of
  Commit), which warns on click. A not-yet-committed day shows **Commit** (additive `commitDay`); if
  that collides with an existing (foreign/manual) tab it's refused with a rename/delete message —
  never an auto-overwrite.
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
- **Edited-since-commit indicator:** commit sets `committed_at == updated_at`, so a later autosave makes
  `updated_at > committed_at`. A committed session in that state shows an amber **"✎ edited since
  commit"** badge (instead of "✓ committed") — signalling local edits not yet in the Sheet, which
  the ♻ Replace button pushes. Detected purely from the two timestamps; no extra columns.

---

## ADR 0008 — Second animal space "free range" (different sheet + layout), via a space selector

**Status:** Accepted (implemented 2026-07-23).

**Context.** Besides the "inside" pens (the original feature: 6 obs × 8 cells K1–K8, one tab per
`day + Π/Μ`), the study also has a **free-range/outside** space with its **own** Google Sheet and a
**different layout**: **no cells** — each tab is ONE day holding both a `ΠΡΩΙ` and a `ΜΕΣΗΜΕΡΙ` block
of 6 observations (`(time) | OBSERV | behaviours`, no Cell/Σ). Behaviour set is space-specific —
see **ADR 0010** (free-range adds a 23rd, **Foraging**; originally assumed identical to inside's 22).

**Decision.** One parameterized UI, not a fork. A **space selector** (Inside / Free range) at the top
drives everything:
- **DB:** an `ethogram_sessions.space` column ('inside'|'free_range') added to the natural key
  `(user_id, session_date, time_of_day, space)`, so both spaces coexist per day (ADR: migration
  `ethogram_add_space`). All persistence carries `space` (defaults 'inside').
- **Grid:** cell count is data-driven — inside = 8, free-range = **1** pseudo-cell. Free-range hides
  the cell selector and records **per observation**. Stored as `[obs][1][beh]`.
- **Commit:** inside is unchanged (additive `commitDay` / guarded `replaceTab`). Free-range is a
  **create-or-overwrite upsert** of the whole day tab (`upsertTab`) to `GSHEET_ID_FREERANGE`: the
  committing half's grid comes from the client, the **other half is read from its stored session**,
  and both blocks are written together — so committing morning then lunch fills one tab without
  losing the earlier half (per the user's workflow; re-committing to update is expected here).
- **Free-range commit guard (parity with inside's foreign-tab protection):** upsert is allowed, but
  the day tab is only overwritten if the app **owns** it — i.e. a *committed* free-range session for
  that day already has `sheet_tab = <tab>`. If a same-named tab exists that the app never committed
  → refuse (`NOT_APP_OWNED`); if an owned tab's `B1` no longer reads `"OBSERV."` → refuse
  (`TAB_SHAPE_MISMATCH`). First-ever commit (tab absent) just creates it. This keeps "commit as often
  as you like" while never clobbering a manually-made/foreign tab. (Free-range does **not** adopt
  inside's *refuse-on-exists* — that would break the intended re-commit-into-one-tab flow.)
- **Tab name:** dashed `D-M` (e.g. `17-7`), no Π/Μ suffix (one tab per day). Shown before commit.

**Consequences.** Inside code paths are untouched (everything gates on `space`/`isFree`). Free-range
lives in a **separate spreadsheet**, so it can never affect the inside research Sheet. The parser and
autosave/resume/transcript/past-sessions infra are reused as-is. Free-range "full grid" table is
hidden (it's cell-shaped); the per-observation list + Copy/CSV cover it.

**Consequences.** Two independent checks (Supabase ownership + A1 shape) must both pass before any
overwrite, so a foreign/manual tab is never clobbered from the app. The correction workflow is now
in-app. The Sheet remains the system of record and the authority on whether a commit can proceed;
Supabase only *gates the Replace offer*. `values.clear` covers `A1:Z100`, so a replaced tab can't keep
stale cells beyond the 49×~25 grid.

---

## ADR 0009 — Transcript → counts via an LLM (Groq), with the deterministic parser as fallback

**Status:** Accepted (implemented 2026-07-23). Supersedes the *primary* role of the deterministic
parser from ADR 0003 (which stays as the fallback).

**Context.** ADR 0003 put transcript→counts in a hand-written deterministic parser
(`lib/ethogram/parser.ts`). It's free and instant, but brittle: it only understands number-**before**
("four running"), one fixed set of synonyms, and no Greek. With **5 researchers** phrasing things many
ways, plus a real bug (number-**after**: "running four" → wrong count) and a Greek requirement, the
rule-based approach doesn't scale.

**Decision.** Do the parsing with an **LLM** (`lib/ethogram/interpret.ts`), keeping the deterministic
parser as a **fallback**:
- **Provider:** a **Groq** chat model (`GROQ_LLM_MODEL`, default `openai/gpt-oss-20b`) — same API key
  and free tier as Whisper, so ~free and no new provider. A small model is plenty for this extraction.
- **Reliability:** Groq **Structured Outputs** (`response_format: json_schema`, `strict: true`) with
  the 22 behaviour names as an `enum` + `temperature 0` → the model can only return valid, in-list
  counts. It naturally handles number-before-or-after, phrasing variety, in-clip self-corrections
  ("two, no three sitting" → 3), and **Greek/English/mixed**.
- **Transcription:** Whisper no longer forces `language=en` → auto-detects Greek or English.
- **Flow:** `/api/ethogram/transcribe` runs Whisper then `interpretTranscript`, returning
  `{text, counts}` (one round-trip). The client **sets** the active cell to `counts` (a clip replaces
  the cell). A standalone `/api/ethogram/interpret` (text → counts) exists for testing without a mic
  and for future re-parsing of stored transcripts.
- **Fallback:** if the LLM call fails/times out/returns null, the client parses the raw text with the
  deterministic `parseToOps` — so we never regress below the old behaviour.

**Consequences.** Phrasing bugs and per-researcher variation largely go away, and Greek works. The
LLM is non-deterministic, mitigated by: strict schema + temp 0, the existing **human verification**
(counts fill the grid; ＋/− fix), and the **raw transcript stored** in `ethogram_recordings`
(auditable + re-parseable via the interpret route). Cost stays ~free (one short call per clip).
Optional future accuracy boost: add a **Greek glossary** of the researchers' actual terms to the
system prompt. If the default model id is ever deprecated, set `GROQ_LLM_MODEL` — until then the
fallback keeps the app working.

---

## ADR 0010 — Free-range gets a 23rd behaviour, **Foraging** (space-specific behaviour set)

**Status:** Accepted (implemented 2026-07-30).

**Context.** ADR 0008 assumed inside and free-range share the same 22 behaviours. Cross-validating a
real free-range session against its transcripts showed the researcher consistently dictates
**"Foraging"** (ground/substrate-directed searching for food — pecking + scratching the pasture),
said *alongside* "Environmental Pecking" in the same clips, so to her they are **distinct**. Foraging
wasn't in the list, so the LLM (constrained to the enum) **silently dropped it** — ~44 birds lost in
one morning. Foraging is a standard poultry-ethology category and is heavily used outdoors but barely
indoors, so it belongs to the **free-range form only**.

**Decision.** Make the behaviour set **space-specific** instead of a single shared list:
- `parser.ts`: `BEHAVIOURS` stays the inside 22; `FORAGING` is a new behaviour **appended** as
  `FREE_BEHAVIOURS = [...BEHAVIOURS, FORAGING]` (23). `behavioursFor(space)` returns the right list.
  Appended last so inside grid/sheet **column indices are unchanged** and inside is fully untouched.
- **Grid** is now `[obs][cell][beh]` where `beh` length depends on space (22 inside / 23 free-range).
  `emptyGrid`/`normalizeGrid` take a `behCount`; `normalizeGrid` **pads older 22-long free-range grids
  to 23** (Foraging = 0) on load. The reducer preserves each cell's own length (no hard-coded 22).
- **LLM:** `interpretTranscript(text, space)` builds its enum from `behavioursFor(space)`, so free-range
  transcription can return Foraging. `/api/ethogram/transcribe?space=` and `/api/ethogram/interpret`
  pass `space` through.
- **Sheet:** free-range day tab (`freeRangeDayRows`) uses `FREE_BEHAVIOURS` → a **23rd column,
  Foraging**, at the end (25 cols total, still within the `A1:Z100` clear range).
- **Backfill:** today's free-range morning session had Foraging injected into the stored grid (index 22)
  from its transcripts; the tab is corrected by re-committing that day from the app (owner-only).

**Consequences.** Inside is unaffected (same 22, same indices). Free-range is 23 everywhere and older
free-range grids upgrade transparently on load. If the outside master Sheet turns out to already have a
Foraging column in a different position, only `FREE_BEHAVIOURS` order + a re-commit are needed — the
data model doesn't care about column position. The deterministic fallback parser still knows only the
shared 22 (Foraging relies on the LLM); acceptable, as the fallback is rare.

---

## ADR 0011 — Long clips fail on upload → client-side 16 kHz-mono-WAV down-encode

**Status:** Accepted (implemented 2026-07-31).

**Context.** A researcher's first real free-range session failed **every time she recorded longer than
~1 minute** ("too long"), so she gave up before doing inside. Vercel runtime logs were decisive: the
successful (shorter) clips log `200`, but the failing long ones **never appear at all** — no runtime
error, no `console.error`, no function invocation. That signature = **Vercel's ~4.5 MB serverless
request-body limit rejecting the upload with a 413 at the platform edge, before `/transcribe` runs**.
So it's **upload size**, definitively — not a Groq duration limit and not a function timeout (either
would have run the function and logged). Earlier mitigations — `maxDuration = 60` (ADR-less, commit
`4683fa4`) and a **48 kbps `audioBitsPerSecond` cap** (`a776bff`) — didn't hold: `audioBitsPerSecond`
is only a **hint** and is ignored on some devices (iOS Safari, and evidently her Android too), so long
clips stayed large.

**Decision.** Make the uploaded size **deterministic and device-independent** by re-encoding the
recording **client-side before upload**:
- `lib/ethogram/wav.ts` `toWav16kMono(blob)` — Web Audio API `decodeAudioData` →
  `OfflineAudioContext(1, …, 16000)` resample → **16 kHz mono 16-bit PCM WAV**. No external library.
  **~32 KB/s** ⇒ 80 s ≈ 2.6 MB, ~2 min under the 4.5 MB cap. 16 kHz mono is transparent for speech
  (Whisper downsamples to 16 kHz regardless), so **no accuracy cost**.
- **Never breaks recording:** if the browser can't decode the recorded container, it returns the
  original blob (`reencoded:false`) and we upload that.
- **Visibility:** `/transcribe` logs the received byte size; on any non-OK upload the client fires a
  `/api/ethogram/clientlog` beacon (status, raw/upload bytes, `reencoded`, UA) so **edge-rejected 413s
  are still observable** despite leaving no server trace. A 413 now shows a clear "record a shorter
  take" message instead of a raw network error.
- The 48 kbps hint stays (harmless, shrinks the intermediate blob), but correctness no longer depends
  on it.

**Consequences.** Long clips (her 70–90 s target, up to ~2 min) upload reliably on any device. Cost is
one client-side decode+resample per clip (fine for these lengths). For **clips beyond ~2 min** the WAV
would approach the cap again — the deferred escalation is a **storage relay** (client → Supabase
Storage/Blob → function fetches it), which removes the request-body limit entirely. See
`docs/ethogram/OVERVIEW.md` §9.
