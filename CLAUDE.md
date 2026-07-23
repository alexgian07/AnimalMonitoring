@AGENTS.md
@SETUP.md

# Project context for Claude

This is a turkey research monitoring dashboard. Stack: Next.js 16 + Clerk auth + Supabase (Postgres + RLS) + Vercel.

If `SETUP.md` was loaded above, it contains the complete walkthrough of how the project was wired up across GitHub, Supabase, Clerk, and Vercel — read it for any setup, deployment, or DB-change questions before asking the user.

Key facts:
- Live URL: https://animal-monitoring.vercel.app
- Auth flow: Clerk → Supabase via third-party auth (no JWT template — uses default Clerk session token with `role: authenticated` claim)
- DB schema: `supabase/schema.sql` (single source of truth — keep it in sync after any manual SQL change)
- Deploy: every `git push` to master auto-deploys via Vercel. Always run `npm run build` locally before pushing.
- User roles: admin / researcher / viewer; managed via in-app `/admin` panel (admin-only)
- New users start with `allowed_locations = []` (no access until admin grants)

> Note: `SETUP.md` is **git-ignored** (local only) — a fresh clone won't have it. The portable,
> committed docs are under `docs/` (see below).

## Ethogram feature (`/ethogram`) — the current focus

Voice data-entry tool for a PhD ethology study: dictate chicken-behaviour counts on a phone →
Groq Whisper transcribes → an on-screen grid → commit a 48-row tab to a Google Sheet. It is the
**default landing page** and lives in its own full-screen layout (no dashboard sidebar).

- **Full docs:** [`docs/ethogram/OVERVIEW.md`](docs/ethogram/OVERVIEW.md) — data model, file map,
  end-to-end flow, Google Sheets/service-account setup, env vars, limitations.
- **Design decisions:** [`docs/adr/DECISIONS.md`](docs/adr/DECISIONS.md).
- **Key files:** `app/ethogram/*`, `app/api/ethogram/*`, `lib/ethogram/*`.
- **Extra env vars:** `GROQ_API_KEY`, `GSHEET_ID`, `GOOGLE_CREDENTIALS`, `GSHEET_ID_FREERANGE` (+ optional `GROQ_MODEL`).
- **Gotcha:** commits are additive by default (new tab, refuse on collision). The one exception is a
  guarded **Replace** for a tab the app itself committed (ADR 0007 — verified via Supabase + an A1
  shape check; foreign tabs are never overwritten). Master Sheet must be a *native* Google Sheet, not
  an uploaded `.xlsx`.

## MCP servers (for Claude agents)

Two paths: **(A)** app **Settings → Connectors** (account-level; Vercel/Supabase/Clerk are in the
catalog as hosted connectors — they appear in your *next* app chat), or **(B)** terminal `claude`
via the repo's `.mcp.json` (copy [`.mcp.json.example`](.mcp.json.example) → `.mcp.json`,
git-ignored, paste a Supabase token). Remote servers work in both; the **local npx Supabase** in
`.mcp.json` is **terminal-only**. New MCP config is picked up at the next session start, not
mid-session.
- **supabase** — read-write, scoped to this project (`.mcp.json` = local npx; Connectors = hosted).
- **vercel** — deploy status / logs / env.
- **clerk** — SDK snippets / auth patterns.

Full setup notes: [`docs/ethogram/OVERVIEW.md`](docs/ethogram/OVERVIEW.md) §8.
