-- Phase 2: New tables for daily monitoring, Aviagen targets,
--          body measurements, feed logs, and recurring tasks.
-- Run once in Supabase SQL Editor.

-- ============================================================
-- 1. AVIAGEN TARGETS (reference table — seeded from Excel)
-- ============================================================

CREATE TABLE IF NOT EXISTS aviagen_targets (
  week_start INTEGER PRIMARY KEY,    -- e.g. 1, 2, 3, ... 9 (=9+ catch-all)
  week_end   INTEGER,                -- nullable for open-ended (9+)
  temp_min   DECIMAL(4,1) NOT NULL,
  temp_max   DECIMAL(4,1) NOT NULL,
  humid_min  INTEGER NOT NULL,
  humid_max  INTEGER NOT NULL,
  notes      TEXT
);

INSERT INTO aviagen_targets (week_start, week_end, temp_min, temp_max, humid_min, humid_max, notes) VALUES
  (1, 1, 32, 35, 60, 70, 'Εβδομάδα 1 (0-7 ημέρες)'),
  (2, 2, 29, 32, 60, 70, 'Εβδομάδα 2'),
  (3, 3, 27, 29, 55, 65, 'Εβδομάδα 3'),
  (4, 4, 24, 27, 55, 65, 'Εβδομάδα 4'),
  (5, 5, 21, 24, 50, 65, 'Εβδομάδα 5'),
  (6, 6, 19, 22, 50, 65, 'Εβδομάδα 6'),
  (7, 8, 17, 20, 50, 65, 'Εβδομάδες 7-8'),
  (9, NULL, 15, 18, 50, 65, 'Εβδομάδα 9 και μετά')
ON CONFLICT (week_start) DO NOTHING;

-- ============================================================
-- 2. DAILY TEMPERATURES (one row per location per day)
-- ============================================================

CREATE TABLE IF NOT EXISTS daily_temperatures (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id  UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  recorded_on  DATE NOT NULL DEFAULT CURRENT_DATE,
  temp_min     DECIMAL(4,1),
  temp_max     DECIMAL(4,1),
  temp_morning DECIMAL(4,1),
  temp_midday  DECIMAL(4,1),
  temp_evening DECIMAL(4,1),
  humidity     INTEGER,         -- percent 0..100
  mortality    INTEGER DEFAULT 0,
  sick_count   INTEGER DEFAULT 0,
  notes        TEXT,
  recorded_by  TEXT NOT NULL,   -- Clerk user id
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (location_id, recorded_on)
);

CREATE INDEX IF NOT EXISTS idx_dailytemp_location ON daily_temperatures(location_id);
CREATE INDEX IF NOT EXISTS idx_dailytemp_date     ON daily_temperatures(recorded_on);

-- ============================================================
-- 3. BODY MEASUREMENTS (per turkey, weekly)
--    Adds the 5 morphometric measurements to existing measurements table.
-- ============================================================

ALTER TABLE measurements ADD COLUMN IF NOT EXISTS metatarsus_length_mm DECIMAL(5,1);
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS metatarsus_diameter_mm DECIMAL(5,1);
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS chest_width_mm DECIMAL(5,1);
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS keel_length_mm DECIMAL(5,1);
ALTER TABLE measurements ADD COLUMN IF NOT EXISTS body_length_mm DECIMAL(5,1);

-- ============================================================
-- 4. FEED LOGS (per location, weekly — mirrors ΖΥΓΙΣΗ ΤΡΟΦΗΣ sheet)
-- ============================================================

CREATE TABLE IF NOT EXISTS feed_logs (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id          UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  feeder_label         TEXT DEFAULT 'main',     -- 'main' or 'extra' (first 2 weeks)
  week_number          INTEGER NOT NULL,        -- 1..28
  week_start_date      DATE NOT NULL,           -- usually a Monday
  weight_before_kg     DECIMAL(6,2),
  feed_added_kg        DECIMAL(6,2),
  weight_after_kg      DECIMAL(6,2),
  consumption_kg       DECIMAL(6,2)
    GENERATED ALWAYS AS (
      CASE WHEN weight_before_kg IS NOT NULL AND feed_added_kg IS NOT NULL AND weight_after_kg IS NOT NULL
           THEN weight_before_kg + feed_added_kg - weight_after_kg
           ELSE NULL END
    ) STORED,
  bird_count           INTEGER,
  avg_weight_kg        DECIMAL(5,2),
  total_flock_kg       DECIMAL(8,2)
    GENERATED ALWAYS AS (
      CASE WHEN bird_count IS NOT NULL AND avg_weight_kg IS NOT NULL
           THEN bird_count * avg_weight_kg ELSE NULL END
    ) STORED,
  weight_gain_kg       DECIMAL(6,2),
  notes                TEXT,
  recorded_by          TEXT NOT NULL,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (location_id, feeder_label, week_number)
);

CREATE INDEX IF NOT EXISTS idx_feedlogs_location ON feed_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_feedlogs_week     ON feed_logs(week_number);

-- ============================================================
-- 5. TASKS (recurring schedule + completed records)
-- ============================================================

-- Recurring template — one row per (day_of_week, time_slot, task)
-- Seeded from ΕΒΔΟΜΑΔΙΑΙΟ sheet.
CREATE TABLE IF NOT EXISTS tasks_template (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  day_of_week  INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),  -- 1=Mon
  time_slot    TEXT,             -- e.g. '08:00 - 09:00'
  task_label   TEXT NOT NULL,
  category     TEXT,             -- 'daily', 'weighing', 'slaughter', 'analysis', 'observation', etc
  position     INTEGER DEFAULT 0
);

INSERT INTO tasks_template (day_of_week, time_slot, task_label, category, position) VALUES
  (1, '08:00 - 09:00', 'Ζύγιση & σωματομετρήσεις',                      'weighing',     1),
  (1, '11:00 - 13:00', 'Καθημερινές + ζύγιση ταΐστρας & προσθήκη τροφής', 'feed',        2),
  (1, '14:30 - 15:00', 'Ανέβασμα ταΐστρας',                              'feed',         3),
  (1, '15:00 - 17:00', 'Έλεγχος ζώων / γενικές εργασίες',                'general',      4),
  (1, '17:00 - 18:00', 'Καθαρισμός / κλείσιμο',                          'cleanup',      5),
  (2, '09:00 - 11:00', 'Σφαγή ζώων',                                     'slaughter',    1),
  (2, '11:00 - 13:00', 'Εκσπλαγχνισμός',                                 'slaughter',    2),
  (2, '15:00 - 17:00', 'Καταγραφή / συντήρηση δειγμάτων σφαγής',         'analysis',     3),
  (2, '17:00 - 18:00', 'Καθαρισμός σφαγείου / κλείσιμο',                 'cleanup',      4),
  (3, '09:00 - 11:00', 'Τεμαχισμός σφαγίων',                             'slaughter',    1),
  (3, '11:00 - 13:00', 'Αναλύσεις ποιότητας κρέατος (pH, χρώμα, υφή)',   'analysis',     2),
  (3, '15:00 - 17:00', 'Συνέχιση αναλύσεων / καταγραφή αποτελεσμάτων',   'analysis',     3),
  (3, '17:00 - 18:00', 'Καθαρισμός εργαστηρίου / κλείσιμο',              'cleanup',      4),
  (4, '09:00 - 11:00', 'Παρατήρηση συμπεριφοράς (1η)',                   'observation',  1),
  (4, '15:00 - 17:00', 'Παρατήρηση συμπεριφοράς (2η)',                   'observation',  2),
  (4, '17:00 - 18:00', 'Καθαρισμός / κλείσιμο',                          'cleanup',      3),
  (5, '09:00 - 11:00', 'Παρατήρηση συμπεριφοράς (1η)',                   'observation',  1),
  (5, '15:00 - 17:00', 'Παρατήρηση συμπεριφοράς (2η)',                   'observation',  2),
  (5, '17:00 - 18:00', 'Καθαρισμός / κλείσιμο',                          'cleanup',      3),
  (6, '09:00 - 11:00', 'Έλεγχος ζώων',                                   'general',      1),
  (7, '09:00 - 11:00', 'Έλεγχος ζώων',                                   'general',      1)
ON CONFLICT DO NOTHING;

-- Daily routine that happens every day
INSERT INTO tasks_template (day_of_week, time_slot, task_label, category, position)
SELECT d, '08:00 - 11:00', 'Καθημερινές εργασίες (τάισμα, πότισμα, καθαρισμός)', 'daily', 0
FROM generate_series(1, 7) AS d
ON CONFLICT DO NOTHING;

-- One-off slaughter dates (manually populated by admin)
CREATE TABLE IF NOT EXISTS slaughter_schedule (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_on  DATE NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (scheduled_on)
);

-- Per-day completion log (which task was done, by whom, when)
CREATE TABLE IF NOT EXISTS tasks_completed (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_label      TEXT NOT NULL,
  completed_on    DATE NOT NULL DEFAULT CURRENT_DATE,
  completed_at    TIME,
  notes           TEXT,
  recorded_by     TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_taskscompleted_date ON tasks_completed(completed_on);

-- ============================================================
-- ENABLE ROW LEVEL SECURITY ON ALL NEW TABLES
-- ============================================================

ALTER TABLE aviagen_targets     ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_temperatures  ENABLE ROW LEVEL SECURITY;
ALTER TABLE feed_logs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks_template      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks_completed     ENABLE ROW LEVEL SECURITY;
ALTER TABLE slaughter_schedule  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

-- aviagen_targets: read-only reference, everyone authenticated
CREATE POLICY "aviagen_select" ON aviagen_targets
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "aviagen_admin_write" ON aviagen_targets
  FOR ALL USING (is_admin());

-- daily_temperatures: scoped by location access
CREATE POLICY "dailytemp_select" ON daily_temperatures
  FOR SELECT USING (can_access_location(location_id));

CREATE POLICY "dailytemp_insert" ON daily_temperatures
  FOR INSERT WITH CHECK (is_researcher_or_admin() AND can_access_location(location_id));

CREATE POLICY "dailytemp_update" ON daily_temperatures
  FOR UPDATE USING (is_researcher_or_admin() AND can_access_location(location_id));

-- feed_logs: scoped by location access
CREATE POLICY "feedlogs_select" ON feed_logs
  FOR SELECT USING (can_access_location(location_id));

CREATE POLICY "feedlogs_insert" ON feed_logs
  FOR INSERT WITH CHECK (is_researcher_or_admin() AND can_access_location(location_id));

CREATE POLICY "feedlogs_update" ON feed_logs
  FOR UPDATE USING (is_researcher_or_admin() AND can_access_location(location_id));

-- tasks_template: read for all, admin only write
CREATE POLICY "taskstpl_select" ON tasks_template
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "taskstpl_admin_write" ON tasks_template
  FOR ALL USING (is_admin());

-- tasks_completed: read for all, write by researcher/admin
CREATE POLICY "tasksdone_select" ON tasks_completed
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "tasksdone_insert" ON tasks_completed
  FOR INSERT WITH CHECK (is_researcher_or_admin());

-- slaughter_schedule: read for all, admin only write
CREATE POLICY "slaughter_select" ON slaughter_schedule
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "slaughter_admin_write" ON slaughter_schedule
  FOR ALL USING (is_admin());
