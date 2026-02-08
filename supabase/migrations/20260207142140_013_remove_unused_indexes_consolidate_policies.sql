/*
  # Remove Unused Indexes and Consolidate RLS Policies

  1. Changes
    - Drop all unused indexes to reduce storage overhead and improve write performance
    - Consolidate multiple permissive SELECT/INSERT/UPDATE policies into single policies
    
  2. Security Improvements
    - Policies are consolidated using combined conditions for admin vs regular user access
    - This eliminates the "multiple permissive policies" warnings while maintaining the same access control

  3. Notes
    - Indexes can be recreated later once query patterns are established
    - Policy consolidation does not change access control behavior
*/

-- Drop unused indexes on users table
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_username;
DROP INDEX IF EXISTS idx_users_pod_id;
DROP INDEX IF EXISTS idx_users_is_admin;

-- Drop unused indexes on links table
DROP INDEX IF EXISTS idx_links_created_at;

-- Drop unused indexes on tasks table
DROP INDEX IF EXISTS idx_tasks_link_id;
DROP INDEX IF EXISTS idx_tasks_user_id;
DROP INDEX IF EXISTS idx_tasks_assigned_to;

-- Drop unused indexes on task_completions table
DROP INDEX IF EXISTS idx_task_completions_task_id;
DROP INDEX IF EXISTS idx_task_completions_verified_by;

-- Drop unused indexes on credit_transactions table
DROP INDEX IF EXISTS idx_credit_transactions_created_at;
DROP INDEX IF EXISTS idx_credit_transactions_related_link_id;
DROP INDEX IF EXISTS idx_credit_transactions_related_task_id;

-- Drop unused indexes on pod_rotations table
DROP INDEX IF EXISTS idx_pod_rotations_user_id;
DROP INDEX IF EXISTS idx_pod_rotations_rotation_date;
DROP INDEX IF EXISTS idx_pod_rotations_new_pod_id;
DROP INDEX IF EXISTS idx_pod_rotations_old_pod_id;

-- Drop unused indexes on payments table
DROP INDEX IF EXISTS idx_payments_user_id;
DROP INDEX IF EXISTS idx_payments_status;

-- Drop unused indexes on ad_campaigns table
DROP INDEX IF EXISTS idx_ad_campaigns_user_id;
DROP INDEX IF EXISTS idx_ad_campaigns_tracking_link;
DROP INDEX IF EXISTS idx_ad_campaigns_status;

-- Drop unused indexes on ad_creatives table
DROP INDEX IF EXISTS idx_ad_creatives_campaign_id;

-- Drop unused indexes on task_attempts table
DROP INDEX IF EXISTS idx_task_attempts_status;
DROP INDEX IF EXISTS idx_task_attempts_task_id;

-- Drop unused indexes on ad_campaign_metrics table
DROP INDEX IF EXISTS idx_ad_campaign_metrics_campaign_id;
DROP INDEX IF EXISTS idx_ad_campaign_metrics_date;

-- Consolidate users table policies
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Users can read other usernames" ON users;
DROP POLICY IF EXISTS "Users can read own full profile" ON users;
DROP POLICY IF EXISTS "Admins can update all users" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;

CREATE POLICY "Users select access"
  ON users FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
    OR true
  );

CREATE POLICY "Users update access"
  ON users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  )
  WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Consolidate links table policies
DROP POLICY IF EXISTS "Admins can read all links" ON links;
DROP POLICY IF EXISTS "Users can read own links" ON links;

CREATE POLICY "Links select access"
  ON links FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Consolidate tasks table policies
DROP POLICY IF EXISTS "Admins can read all tasks" ON tasks;
DROP POLICY IF EXISTS "Users can read available tasks" ON tasks;
DROP POLICY IF EXISTS "Admins can insert any task" ON tasks;
DROP POLICY IF EXISTS "Users can insert tasks for own links" ON tasks;
DROP POLICY IF EXISTS "Admins can update any task" ON tasks;
DROP POLICY IF EXISTS "Users can update assigned tasks" ON tasks;

CREATE POLICY "Tasks select access"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
    OR (status = 'pending' AND assigned_to_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM links l WHERE l.id = tasks.link_id AND l.user_id = auth.uid())
  );

CREATE POLICY "Tasks insert access"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
    OR EXISTS (SELECT 1 FROM links l WHERE l.id = link_id AND l.user_id = auth.uid())
  );

CREATE POLICY "Tasks update access"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
    OR assigned_to_user_id = auth.uid()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
    OR assigned_to_user_id = auth.uid()
  );

-- Consolidate task_completions table policies
DROP POLICY IF EXISTS "Admins can read all completions" ON task_completions;
DROP POLICY IF EXISTS "Users can read completions for own tasks" ON task_completions;
DROP POLICY IF EXISTS "Users can read own completions" ON task_completions;

CREATE POLICY "Task completions select access"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
    OR EXISTS (
      SELECT 1 FROM tasks t 
      JOIN links l ON t.link_id = l.id 
      WHERE t.id = task_completions.task_id AND l.user_id = auth.uid()
    )
  );

-- Consolidate credit_transactions table policies
DROP POLICY IF EXISTS "Admins can read all transactions" ON credit_transactions;
DROP POLICY IF EXISTS "Users can read own transactions" ON credit_transactions;

CREATE POLICY "Credit transactions select access"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Consolidate payments table policies
DROP POLICY IF EXISTS "Admins can read all payments" ON payments;
DROP POLICY IF EXISTS "Users can read own payments" ON payments;

CREATE POLICY "Payments select access"
  ON payments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Consolidate ad_campaigns table policies
DROP POLICY IF EXISTS "Admin users can view all campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Users can view own campaigns" ON ad_campaigns;

CREATE POLICY "Ad campaigns select access"
  ON ad_campaigns FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Consolidate ad_creatives table policies
DROP POLICY IF EXISTS "Admin users can view all creatives" ON ad_creatives;
DROP POLICY IF EXISTS "Users can view own campaign creatives" ON ad_creatives;

CREATE POLICY "Ad creatives select access"
  ON ad_creatives FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.id = ad_creatives.campaign_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );
