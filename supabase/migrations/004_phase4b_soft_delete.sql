-- Phase 4b: Soft delete on all data tables
-- deleted_at = NULL → active row. NOT NULL → deleted (hidden, but kept for audit)

ALTER TABLE turkeys             ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE measurements        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE culls               ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE daily_temperatures  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE feed_logs           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE tasks_completed     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Indexes for fast "active rows only" filtering
CREATE INDEX IF NOT EXISTS idx_turkeys_active           ON turkeys (location_id)            WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_measurements_active      ON measurements (turkey_id)         WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_dailytemp_active         ON daily_temperatures (location_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_feedlogs_active          ON feed_logs (location_id)          WHERE deleted_at IS NULL;
