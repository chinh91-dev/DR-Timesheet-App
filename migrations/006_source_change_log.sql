-- ============================================================
-- MIGRATION 006: Application-Level WAL — Change Log
-- ⚠️  RUN THIS ON YOUR SOURCE DATABASE (time-team-tracker)
--     NOT on the DR database.
-- ============================================================
-- This creates the continuous transaction log that enables true
-- Point-in-Time Recovery. Every INSERT, UPDATE, and DELETE on
-- any tracked table is automatically captured here.
-- ============================================================

-- Change log table
CREATE TABLE IF NOT EXISTS change_log (
  id              BIGSERIAL PRIMARY KEY,
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  table_name      TEXT NOT NULL,
  operation       TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  row_id          TEXT,                  -- primary key value of the affected row (cast to text)
  new_data        JSONB,                 -- full row after change (NULL for DELETE)
  old_data        JSONB,                 -- full row before change (NULL for INSERT)
  transaction_id  BIGINT DEFAULT txid_current()  -- groups rows changed in same transaction
);

-- Index for efficient time-range queries (the main PITR query pattern)
CREATE INDEX IF NOT EXISTS idx_change_log_changed_at   ON change_log (changed_at);
CREATE INDEX IF NOT EXISTS idx_change_log_table_time   ON change_log (table_name, changed_at);
CREATE INDEX IF NOT EXISTS idx_change_log_transaction  ON change_log (transaction_id);

-- ============================================================
-- Trigger function — shared by all tracked tables
-- ============================================================
CREATE OR REPLACE FUNCTION log_change()
RETURNS TRIGGER AS $$
DECLARE
  v_row_id TEXT;
BEGIN
  -- Try to capture the primary key value
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_row_id := (OLD.id)::TEXT;
    ELSE
      v_row_id := (NEW.id)::TEXT;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_row_id := NULL;
  END;

  INSERT INTO change_log (table_name, operation, row_id, new_data, old_data)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    v_row_id,
    CASE WHEN TG_OP = 'DELETE'  THEN NULL ELSE to_jsonb(NEW) END,
    CASE WHEN TG_OP = 'INSERT'  THEN NULL ELSE to_jsonb(OLD) END
  );

  RETURN NULL; -- AFTER trigger, return value is ignored
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Attach trigger to all 25 core tables
-- ============================================================

CREATE OR REPLACE TRIGGER trg_change_log_accounts
  AFTER INSERT OR UPDATE OR DELETE ON accounts
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_profiles
  AFTER INSERT OR UPDATE OR DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_timesheet_entries
  AFTER INSERT OR UPDATE OR DELETE ON timesheet_entries
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_projects
  AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_project_assignments
  AFTER INSERT OR UPDATE OR DELETE ON project_assignments
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_tasks
  AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_leave_applications
  AFTER INSERT OR UPDATE OR DELETE ON leave_applications
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_leave_balances
  AFTER INSERT OR UPDATE OR DELETE ON leave_balances
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_leave_types
  AFTER INSERT OR UPDATE OR DELETE ON leave_types
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_work_schedules
  AFTER INSERT OR UPDATE OR DELETE ON work_schedules
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_weekly_work_schedules
  AFTER INSERT OR UPDATE OR DELETE ON weekly_work_schedules
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_public_holidays
  AFTER INSERT OR UPDATE OR DELETE ON public_holidays
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_customers
  AFTER INSERT OR UPDATE OR DELETE ON customers
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_contracts
  AFTER INSERT OR UPDATE OR DELETE ON contracts
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_contract_services
  AFTER INSERT OR UPDATE OR DELETE ON contract_services
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_expense_categories
  AFTER INSERT OR UPDATE OR DELETE ON expense_categories
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_incidents
  AFTER INSERT OR UPDATE OR DELETE ON incidents
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_incident_history
  AFTER INSERT OR UPDATE OR DELETE ON incident_history
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_assets
  AFTER INSERT OR UPDATE OR DELETE ON assets
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_audit_logs
  AFTER INSERT OR UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_invitations
  AFTER INSERT OR UPDATE OR DELETE ON invitations
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_contacts
  AFTER INSERT OR UPDATE OR DELETE ON contacts
  FOR EACH ROW EXECUTE FUNCTION log_change();

CREATE OR REPLACE TRIGGER trg_change_log_services
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH ROW EXECUTE FUNCTION log_change();
