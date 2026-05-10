-- Phase 11: Relax permissions for small trusted-team use case (3 users, all researchers)
-- Allow researchers (not just admins) to write slaughter_schedule + tasks_template

-- Drop the admin-only policies and recreate as researcher-or-admin

DROP POLICY IF EXISTS "slaughter_admin_write" ON slaughter_schedule;
CREATE POLICY "slaughter_write" ON slaughter_schedule
  FOR ALL USING (is_researcher_or_admin());

DROP POLICY IF EXISTS "taskstpl_admin_write" ON tasks_template;
CREATE POLICY "taskstpl_write" ON tasks_template
  FOR ALL USING (is_researcher_or_admin());
