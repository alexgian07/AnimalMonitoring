-- ============================================================
-- TURKEY RESEARCH DASHBOARD - Supabase Schema
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  position    INTEGER,                                   -- 1..8 ordering
  side        TEXT CHECK (side IN ('left','right')),     -- left = 1..4, right = 5..8
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE turkeys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  tag         TEXT NOT NULL,
  sex         TEXT DEFAULT 'Unknown' CHECK (sex IN ('M', 'F', 'Unknown')),
  birth_date  DATE,
  status      TEXT DEFAULT 'alive' CHECK (status IN ('alive', 'culled', 'dead')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(location_id, tag)
);

CREATE TABLE measurements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turkey_id           UUID NOT NULL REFERENCES turkeys(id) ON DELETE CASCADE,
  location_id         UUID NOT NULL REFERENCES locations(id),
  measured_at         DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg           DECIMAL(5,2),
  temperature_celsius DECIMAL(4,1),
  notes               TEXT,
  recorded_by         TEXT NOT NULL, -- Clerk user ID
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE culls (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  turkey_id       UUID NOT NULL REFERENCES turkeys(id),
  location_id     UUID NOT NULL REFERENCES locations(id),
  culled_at       DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_at_cull  DECIMAL(5,2),
  reason          TEXT DEFAULT 'harvest' CHECK (reason IN ('harvest', 'illness', 'injury', 'other')),
  notes           TEXT,
  recorded_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- User profiles synced from Clerk via webhook or on first login
CREATE TABLE profiles (
  id                TEXT PRIMARY KEY,               -- Clerk user ID
  email             TEXT NOT NULL,
  name              TEXT,
  role              TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'researcher', 'viewer')),
  allowed_locations UUID[],                         -- NULL = all locations
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_turkeys_location    ON turkeys(location_id);
CREATE INDEX idx_turkeys_status      ON turkeys(status);
CREATE INDEX idx_measurements_turkey ON measurements(turkey_id);
CREATE INDEX idx_measurements_date   ON measurements(measured_at);
CREATE INDEX idx_culls_location      ON culls(location_id);
CREATE INDEX idx_culls_date          ON culls(culled_at);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE turkeys      ENABLE ROW LEVEL SECURITY;
ALTER TABLE measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE culls        ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;

-- NOTE: these SECURITY DEFINER helpers pin `search_path = ''` and fully schema-qualify
-- their table refs (migration: harden_helper_search_path) to close the mutable-search_path
-- privilege-escalation vector (Supabase advisor lint 0011).

-- Helper: get calling user's profile
CREATE OR REPLACE FUNCTION get_my_profile()
RETURNS public.profiles
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT * FROM public.profiles WHERE id = current_setting('request.jwt.claims', true)::json->>'sub';
$$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role = 'admin' FROM public.profiles
  WHERE id = current_setting('request.jwt.claims', true)::json->>'sub';
$$;

-- Helper: check if current user is researcher or admin
CREATE OR REPLACE FUNCTION is_researcher_or_admin()
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role IN ('admin', 'researcher') FROM public.profiles
  WHERE id = current_setting('request.jwt.claims', true)::json->>'sub';
$$;

-- Helper: check if user can access a location
CREATE OR REPLACE FUNCTION can_access_location(loc_id UUID)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = current_setting('request.jwt.claims', true)::json->>'sub'
      AND (allowed_locations IS NULL OR loc_id = ANY(allowed_locations))
  );
$$;

-- LOCATIONS policies
CREATE POLICY "locations_select" ON locations
  FOR SELECT USING (can_access_location(id));

CREATE POLICY "locations_insert" ON locations
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "locations_update" ON locations
  FOR UPDATE USING (is_admin());

-- TURKEYS policies
CREATE POLICY "turkeys_select" ON turkeys
  FOR SELECT USING (can_access_location(location_id));

CREATE POLICY "turkeys_insert" ON turkeys
  FOR INSERT WITH CHECK (is_researcher_or_admin() AND can_access_location(location_id));

CREATE POLICY "turkeys_update" ON turkeys
  FOR UPDATE USING (is_researcher_or_admin() AND can_access_location(location_id));

-- MEASUREMENTS policies
CREATE POLICY "measurements_select" ON measurements
  FOR SELECT USING (can_access_location(location_id));

CREATE POLICY "measurements_insert" ON measurements
  FOR INSERT WITH CHECK (is_researcher_or_admin() AND can_access_location(location_id));

CREATE POLICY "measurements_update" ON measurements
  FOR UPDATE USING (
    is_researcher_or_admin()
    AND recorded_by = current_setting('request.jwt.claims', true)::json->>'sub'
  );

-- CULLS policies
CREATE POLICY "culls_select" ON culls
  FOR SELECT USING (can_access_location(location_id));

CREATE POLICY "culls_insert" ON culls
  FOR INSERT WITH CHECK (is_researcher_or_admin() AND can_access_location(location_id));

-- PROFILES policies
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "profiles_select_admin" ON profiles
  FOR SELECT USING (is_admin());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT WITH CHECK (id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (id = current_setting('request.jwt.claims', true)::json->>'sub');

CREATE POLICY "profiles_update_admin" ON profiles
  FOR UPDATE USING (is_admin());

-- ============================================================
-- SEED: 8 default locations
-- ============================================================

INSERT INTO locations (name, description, position, side) VALUES
  ('Κελί 1', 'Αριστερή πλευρά', 1, 'left'),
  ('Κελί 2', 'Αριστερή πλευρά', 2, 'left'),
  ('Κελί 3', 'Αριστερή πλευρά', 3, 'left'),
  ('Κελί 4', 'Αριστερή πλευρά', 4, 'left'),
  ('Κελί 5', 'Δεξιά πλευρά',    5, 'right'),
  ('Κελί 6', 'Δεξιά πλευρά',    6, 'right'),
  ('Κελί 7', 'Δεξιά πλευρά',    7, 'right'),
  ('Κελί 8', 'Δεξιά πλευρά',    8, 'right');

-- ============================================================
-- ETHOGRAM VOICE-ENTRY PERSISTENCE
-- (migration: ethogram_persistence — the /ethogram feature)
-- Sessions autosave the live grid (crash recovery + resume);
-- recordings are the per-clip transcript audit trail.
-- Ownership-based RLS: each user manages only their own rows; admins may read all.
-- ============================================================

CREATE TABLE ethogram_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,                                    -- Clerk user id (owner/creator)
  session_date DATE NOT NULL,
  time_of_day  TEXT NOT NULL CHECK (time_of_day IN ('Π','Μ')),   -- Πρωί / Μεσημέρι
  template     TEXT NOT NULL DEFAULT '22-july',
  data         JSONB NOT NULL DEFAULT '[]'::jsonb,               -- [obs][cell][behaviour] grid, autosaved
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','committed')),
  sheet_tab    TEXT,                                             -- tab name once committed
  committed_by TEXT,                                             -- Clerk user id who committed
  committed_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, session_date, time_of_day)                    -- one session per (day, AM/PM) per user
);

CREATE TABLE ethogram_recordings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES ethogram_sessions(id) ON DELETE CASCADE,
  obs         SMALLINT NOT NULL CHECK (obs  BETWEEN 1 AND 6),
  cell        SMALLINT NOT NULL CHECK (cell BETWEEN 1 AND 8),
  transcript  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ethogram_sessions_user      ON ethogram_sessions(user_id);
CREATE INDEX idx_ethogram_recordings_session ON ethogram_recordings(session_id);

ALTER TABLE ethogram_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ethogram_recordings ENABLE ROW LEVEL SECURITY;

-- SESSIONS: owner manages own rows; admins may read all
CREATE POLICY "ethogram_sessions_select" ON ethogram_sessions
  FOR SELECT USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR is_admin());
CREATE POLICY "ethogram_sessions_insert" ON ethogram_sessions
  FOR INSERT WITH CHECK (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
CREATE POLICY "ethogram_sessions_update" ON ethogram_sessions
  FOR UPDATE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');
CREATE POLICY "ethogram_sessions_delete" ON ethogram_sessions
  FOR DELETE USING (user_id = current_setting('request.jwt.claims', true)::json->>'sub');

-- RECORDINGS: inherit ownership from the parent session
CREATE POLICY "ethogram_recordings_select" ON ethogram_recordings
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM ethogram_sessions s
    WHERE s.id = session_id
      AND (s.user_id = current_setting('request.jwt.claims', true)::json->>'sub' OR is_admin())
  ));
CREATE POLICY "ethogram_recordings_insert" ON ethogram_recordings
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM ethogram_sessions s
    WHERE s.id = session_id
      AND s.user_id = current_setting('request.jwt.claims', true)::json->>'sub'
  ));
