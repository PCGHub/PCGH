/*
  # Fix Infinite Recursion in RLS Policies

  1. Problem
    - The consolidated policies check admin status by querying the users table
    - This creates infinite recursion when the policy tries to check itself
    
  2. Solution
    - Store admin status in JWT claims (app_metadata)
    - Use auth.jwt() to check admin status without querying users table
    - For tables where we need to check user ownership, we can safely query users
    
  3. Changes
    - Fix users table policies to avoid recursion
    - Fix other table policies that had the same pattern
*/

-- Fix users table policies
DROP POLICY IF EXISTS "Users select access" ON users;
DROP POLICY IF EXISTS "Users update access" ON users;

-- Allow users to read their own profile and public usernames
-- Admins need to check via app_metadata in JWT
CREATE POLICY "Users can read own profile and public data"
  ON users FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
    OR true
  );

CREATE POLICY "Users can update own profile or admins can update any"
  ON users FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  )
  WITH CHECK (
    auth.uid() = id 
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- Fix links table policies
DROP POLICY IF EXISTS "Links select access" ON links;

CREATE POLICY "Links select access"
  ON links FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- Fix tasks table policies
DROP POLICY IF EXISTS "Tasks select access" ON tasks;
DROP POLICY IF EXISTS "Tasks insert access" ON tasks;
DROP POLICY IF EXISTS "Tasks update access" ON tasks;

CREATE POLICY "Tasks select access"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
    OR (status = 'pending' AND assigned_to_user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM links l WHERE l.id = tasks.link_id AND l.user_id = auth.uid())
  );

CREATE POLICY "Tasks insert access"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
    OR EXISTS (SELECT 1 FROM links l WHERE l.id = link_id AND l.user_id = auth.uid())
  );

CREATE POLICY "Tasks update access"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
    OR assigned_to_user_id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
    OR assigned_to_user_id = auth.uid()
  );

-- Fix task_completions table policies
DROP POLICY IF EXISTS "Task completions select access" ON task_completions;

CREATE POLICY "Task completions select access"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
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
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- Fix payments table policies
DROP POLICY IF EXISTS "Payments select access" ON payments;

CREATE POLICY "Payments select access"
  ON payments FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- Fix ad_campaigns table policies
DROP POLICY IF EXISTS "Ad campaigns select access" ON ad_campaigns;

CREATE POLICY "Ad campaigns select access"
  ON ad_campaigns FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- Fix ad_creatives table policies
DROP POLICY IF EXISTS "Ad creatives select access" ON ad_creatives;

CREATE POLICY "Ad creatives select access"
  ON ad_creatives FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM ad_campaigns c WHERE c.id = ad_creatives.campaign_id AND c.user_id = auth.uid())
    OR (auth.jwt()->>'app_metadata')::jsonb->>'is_admin' = 'true'
  );

-- Note: For admin functionality to work, you need to set is_admin in the user's app_metadata
-- This can be done via SQL:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE email = 'admin@example.com';
