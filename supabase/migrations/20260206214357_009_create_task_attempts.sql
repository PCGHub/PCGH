/*
  # Create task_attempts table for server-side visit duration tracking

  1. New Tables
    - `task_attempts`
      - `id` (uuid, primary key)
      - `task_id` (uuid, FK to tasks)
      - `user_id` (uuid, FK to users)
      - `attempt_number` (integer, 1 or 2)
      - `started_at` (timestamptz, server time when attempt began)
      - `verified_at` (timestamptz, server time when user claimed completion)
      - `duration_seconds` (numeric, computed on verify)
      - `status` (text: started, completed, failed, locked)
      - `failure_reason` (text, explanation if failed)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on task_attempts
    - Users can read their own attempts
    - Insert/update restricted to authenticated users for their own records

  3. Indexes
    - Composite index on (user_id, task_id) for fast lookups
    - Index on status for filtering

  4. Constraints
    - Max 2 attempts per user per task enforced by unique constraint on (user_id, task_id, attempt_number)
    - attempt_number must be 1 or 2
*/

CREATE TABLE IF NOT EXISTS task_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_number integer NOT NULL DEFAULT 1 CHECK (attempt_number IN (1, 2)),
  started_at timestamptz NOT NULL DEFAULT now(),
  verified_at timestamptz,
  duration_seconds numeric,
  status text NOT NULL DEFAULT 'started' CHECK (status IN ('started', 'completed', 'failed', 'locked')),
  failure_reason text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, task_id, attempt_number)
);

ALTER TABLE task_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own attempts"
  ON task_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts"
  ON task_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own attempts"
  ON task_attempts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_task_attempts_user_task ON task_attempts(user_id, task_id);
CREATE INDEX IF NOT EXISTS idx_task_attempts_status ON task_attempts(status);
CREATE INDEX IF NOT EXISTS idx_task_attempts_task_id ON task_attempts(task_id);
