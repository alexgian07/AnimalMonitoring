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
