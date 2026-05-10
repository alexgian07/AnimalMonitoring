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
