/*
  # Simplify Users Policy to Prevent Recursion

  1. Problem
    - Cannot query users table from within users table policy (infinite recursion)
    - But other tables CAN safely query users table to check is_admin
    
  2. Solution
    - For users table: Simple policy that allows authenticated users to read any user
      (usernames are public info, sensitive fields can be restricted in app layer)
    - For other tables: Can safely check is_admin by querying users table
    
  3. Security
    - Users table: All authenticated users can read all profiles
    - Updates: Only own profile or if checking admin via app_metadata
    - Other tables: Properly check admin status via users table
*/

-- Simplify users table SELECT policy to avoid recursion
DROP POLICY IF EXISTS "Users can read own profile and public data" ON users;

CREATE POLICY "Authenticated users can read all profiles"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Keep update policy simple - check app_metadata for admin
DROP POLICY IF EXISTS "Users can update own profile or admins can update any" ON users;

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Separate admin update policy
CREATE POLICY "Admins can update any profile"
  ON users FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  )
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- For other tables, we CAN safely query users table to check is_admin
-- since we're not creating recursion

-- Fix links table policies
DROP POLICY IF EXISTS "Links select access" ON links;

CREATE POLICY "Links select access"
  ON links FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Fix tasks table policies  
DROP POLICY IF EXISTS "Tasks select access" ON tasks;
DROP POLICY IF EXISTS "Tasks insert access" ON tasks;
DROP POLICY IF EXISTS "Tasks update access" ON tasks;

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

-- Fix task_completions table policies
DROP POLICY IF EXISTS "Task completions select access" ON task_completions;

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

-- Fix credit_transactions table policies
DROP POLICY IF EXISTS "Credit transactions select access" ON credit_transactions;

CREATE POLICY "Credit transactions select access"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Fix payments table policies
DROP POLICY IF EXISTS "Payments select access" ON payments;

CREATE POLICY "Payments select access"
  ON payments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Fix ad_campaigns table policies
DROP POLICY IF EXISTS "Ad campaigns select access" ON ad_campaigns;

CREATE POLICY "Ad campaigns select access"
  ON ad_campaigns FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );

-- Fix ad_creatives table policies
DROP POLICY IF EXISTS "Ad creatives select access" ON ad_creatives;

CREATE POLICY "Ad creatives select access"
  ON ad_creatives FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.id = ad_creatives.campaign_id AND c.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.is_admin = true)
  );
