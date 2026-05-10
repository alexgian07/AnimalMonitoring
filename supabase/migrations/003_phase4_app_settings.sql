-- Phase 4: Global app settings (singleton row)
-- Project start date drives "current breeding week" for Aviagen comparisons.

CREATE TABLE IF NOT EXISTS app_settings (
  id                  INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  project_start_date  DATE NOT NULL,
  project_name        TEXT,
  notes               TEXT,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Seed singleton row with the actual project start date
INSERT INTO app_settings (id, project_start_date, project_name)
VALUES (1, '2026-05-12', 'Έρευνα Γαλοπούλας 2026')
ON CONFLICT (id) DO NOTHING;

-- RLS: everyone authenticated reads; only admins write
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settings_select" ON app_settings
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "settings_admin_write" ON app_settings
  FOR ALL USING (is_admin());
