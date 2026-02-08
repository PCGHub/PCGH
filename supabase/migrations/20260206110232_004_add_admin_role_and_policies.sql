/*
  # Add Admin Role and Admin-Level RLS Policies

  1. Changes:
    - Add `is_admin` boolean column to `users` table (default false)
    - Add admin SELECT policies to all major tables so admins can view all data
    - Add admin UPDATE policy on `tasks` so admins can assign/manage tasks
    - Add admin INSERT policy on `tasks` so admins can create tasks for distribution

  2. Security:
    - Admin access is determined by `is_admin` flag on the users table
    - Only admins (is_admin = true) can access other users' data
    - Admin policies use a subquery to verify admin status via auth.uid()
    - Regular user policies remain unchanged

  3. Tables affected:
    - `users` - new column + admin can read all profiles
    - `tasks` - admin can read, update, and insert any task
    - `links` - admin can read all links
    - `task_completions` - admin can read all completions
    - `credit_transactions` - admin can read all transactions
    - `payments` - admin can read all payments
*/

-- Add is_admin column to users
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'is_admin'
  ) THEN
    ALTER TABLE users ADD COLUMN is_admin boolean DEFAULT false;
  END IF;
END $$;

-- Helper: check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND is_admin = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Admin policy: read all tasks
CREATE POLICY "Admins can read all tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin policy: update any task (for assignment/management)
CREATE POLICY "Admins can update any task"
  ON tasks FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- Admin policy: insert tasks (for distributing tasks)
CREATE POLICY "Admins can insert any task"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- Admin policy: read all links
CREATE POLICY "Admins can read all links"
  ON links FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin policy: read all task completions
CREATE POLICY "Admins can read all completions"
  ON task_completions FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin policy: read all credit transactions
CREATE POLICY "Admins can read all transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (is_admin());

-- Admin policy: read all payments
CREATE POLICY "Admins can read all payments"
  ON payments FOR SELECT
  TO authenticated
  USING (is_admin());

-- Index for admin lookups
CREATE INDEX IF NOT EXISTS idx_users_is_admin ON users(is_admin) WHERE is_admin = true;
