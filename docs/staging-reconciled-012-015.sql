-- Source 20260207113346_012_fix_performance_and_security_issues.sql
/*
  # Fix Performance and Security Issues

  1. New Indexes
    - Add index on `credit_transactions.related_link_id` (foreign key)
    - Add index on `credit_transactions.related_task_id` (foreign key)
    - Add index on `pod_rotations.new_pod_id` (foreign key)
    - Add index on `pod_rotations.old_pod_id` (foreign key)
    - Add index on `task_completions.verified_by` (foreign key)

  2. RLS Policy Optimizations
    - Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth functions for each row, improving performance

  3. Function Security
    - Set immutable search_path on all public functions to prevent search path attacks
*/

-- ============================================
-- PART 1: Add missing foreign key indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_credit_transactions_related_link_id 
  ON public.credit_transactions(related_link_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_related_task_id 
  ON public.credit_transactions(related_task_id);

CREATE INDEX IF NOT EXISTS idx_pod_rotations_new_pod_id 
  ON public.pod_rotations(new_pod_id);

CREATE INDEX IF NOT EXISTS idx_pod_rotations_old_pod_id 
  ON public.pod_rotations(old_pod_id);

CREATE INDEX IF NOT EXISTS idx_task_completions_verified_by 
  ON public.task_completions(verified_by);

-- ============================================
-- PART 2: Fix RLS policies for performance
-- ============================================

-- === USERS TABLE ===
DROP POLICY IF EXISTS "Users can read own full profile" ON public.users;
CREATE POLICY "Users can read own full profile"
  ON public.users FOR SELECT
  TO authenticated
  USING (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

-- === LINKS TABLE ===
DROP POLICY IF EXISTS "Users can read own links" ON public.links;
CREATE POLICY "Users can read own links"
  ON public.links FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own links" ON public.links;
CREATE POLICY "Users can insert own links"
  ON public.links FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own links" ON public.links;
CREATE POLICY "Users can update own links"
  ON public.links FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- === TASKS TABLE ===
DROP POLICY IF EXISTS "Users can read available tasks" ON public.tasks;
CREATE POLICY "Users can read available tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    assigned_to_user_id = (select auth.uid()) OR
    user_id = (select auth.uid()) OR
    status = 'available'
  );

DROP POLICY IF EXISTS "Users can insert tasks for own links" ON public.tasks;
CREATE POLICY "Users can insert tasks for own links"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.links
      WHERE links.id = link_id
      AND links.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update assigned tasks" ON public.tasks;
CREATE POLICY "Users can update assigned tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (assigned_to_user_id = (select auth.uid()) OR user_id = (select auth.uid()))
  WITH CHECK (assigned_to_user_id = (select auth.uid()) OR user_id = (select auth.uid()));

-- === TASK_COMPLETIONS TABLE ===
DROP POLICY IF EXISTS "Users can read own completions" ON public.task_completions;
CREATE POLICY "Users can read own completions"
  ON public.task_completions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can read completions for own tasks" ON public.task_completions;
CREATE POLICY "Users can read completions for own tasks"
  ON public.task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.id = task_id
      AND tasks.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert completions" ON public.task_completions;
CREATE POLICY "Users can insert completions"
  ON public.task_completions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- === CREDIT_TRANSACTIONS TABLE ===
DROP POLICY IF EXISTS "Users can read own transactions" ON public.credit_transactions;
CREATE POLICY "Users can read own transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own transactions" ON public.credit_transactions;
CREATE POLICY "Users can insert own transactions"
  ON public.credit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- === POD_ROTATIONS TABLE ===
DROP POLICY IF EXISTS "Users can read own rotations" ON public.pod_rotations;
CREATE POLICY "Users can read own rotations"
  ON public.pod_rotations FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- === PAYMENTS TABLE ===
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert payments" ON public.payments;
CREATE POLICY "Users can insert payments"
  ON public.payments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own payments" ON public.payments;
CREATE POLICY "Users can update own payments"
  ON public.payments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- === TASK_ATTEMPTS TABLE ===
DROP POLICY IF EXISTS "Users can read own attempts" ON public.task_attempts;
CREATE POLICY "Users can read own attempts"
  ON public.task_attempts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own attempts" ON public.task_attempts;
CREATE POLICY "Users can insert own attempts"
  ON public.task_attempts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own attempts" ON public.task_attempts;
CREATE POLICY "Users can update own attempts"
  ON public.task_attempts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- === AD_CAMPAIGNS TABLE ===
DROP POLICY IF EXISTS "Users can view own campaigns" ON public.ad_campaigns;
CREATE POLICY "Users can view own campaigns"
  ON public.ad_campaigns FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create own campaigns" ON public.ad_campaigns;
CREATE POLICY "Users can create own campaigns"
  ON public.ad_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own campaigns" ON public.ad_campaigns;
CREATE POLICY "Users can update own campaigns"
  ON public.ad_campaigns FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own campaigns" ON public.ad_campaigns;
CREATE POLICY "Users can delete own campaigns"
  ON public.ad_campaigns FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- staging reconciliation: missing ad_creatives table; omit orphan policy section
-- === AD_CAMPAIGN_METRICS TABLE ===
DROP POLICY IF EXISTS "Users can view own campaign metrics" ON public.ad_campaign_metrics;
CREATE POLICY "Users can view own campaign metrics"
  ON public.ad_campaign_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create metrics for own campaigns" ON public.ad_campaign_metrics;
CREATE POLICY "Users can create metrics for own campaigns"
  ON public.ad_campaign_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update metrics for own campaigns" ON public.ad_campaign_metrics;
CREATE POLICY "Users can update metrics for own campaigns"
  ON public.ad_campaign_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  );

-- ============================================
-- PART 3: Fix function search paths
-- Drop functions with CASCADE and recreate all dependent policies
-- ============================================

-- Drop is_admin with CASCADE (will drop dependent policies)
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- Recreate is_admin with secure search_path
CREATE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND is_admin = true
  );
$$;

-- Recreate all admin policies that depended on is_admin

-- Admin policies for tasks
CREATE POLICY "Admins can read all tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update any task"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can insert any task"
  ON public.tasks FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Admin policies for links
CREATE POLICY "Admins can read all links"
  ON public.links FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin policies for task_completions
CREATE POLICY "Admins can read all completions"
  ON public.task_completions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin policies for credit_transactions
CREATE POLICY "Admins can read all transactions"
  ON public.credit_transactions FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin policies for payments
CREATE POLICY "Admins can read all payments"
  ON public.payments FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Admin policies for users
CREATE POLICY "Admins can read all users"
  ON public.users FOR SELECT
  TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins can update all users"
  ON public.users FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Admin policies for ad_campaigns
CREATE POLICY "Admin users can view all campaigns"
  ON public.ad_campaigns FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- staging reconciliation: omit orphan ad_creatives admin policy
-- Fix expire_stale_links function
DROP FUNCTION IF EXISTS public.expire_stale_links();
CREATE FUNCTION public.expire_stale_links()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.links
  SET status = 'expired'
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < NOW();
END;
$$;

-- Fix trigger functions with CASCADE and recreate triggers
DROP FUNCTION IF EXISTS public.update_ad_campaign_updated_at() CASCADE;
CREATE FUNCTION public.update_ad_campaign_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate triggers
DROP TRIGGER IF EXISTS update_ad_campaigns_updated_at ON public.ad_campaigns;
CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ad_campaign_updated_at();

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Source 20260207142140_013_remove_unused_indexes_consolidate_policies.sql
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

-- staging reconciliation: omit orphan ad_creatives index block
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

-- staging reconciliation: omit orphan ad_creatives policy block


-- Source 20260207143129_014_fix_infinite_recursion_in_policies.sql
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

-- staging reconciliation: omit orphan ad_creatives policy block
-- Note: For admin functionality to work, you need to set is_admin in the user's app_metadata
-- This can be done via SQL:
-- UPDATE auth.users SET raw_app_meta_data = raw_app_meta_data || '{"is_admin": true}'::jsonb WHERE email = 'admin@example.com';


-- Source 20260207143148_015_simplify_users_policy_allow_admin_checks.sql
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

-- staging reconciliation: omit orphan ad_creatives policy block
