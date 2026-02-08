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

-- === AD_CREATIVES TABLE ===
DROP POLICY IF EXISTS "Users can view own campaign creatives" ON public.ad_creatives;
CREATE POLICY "Users can view own campaign creatives"
  ON public.ad_creatives FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create own campaign creatives" ON public.ad_creatives;
CREATE POLICY "Users can create own campaign creatives"
  ON public.ad_creatives FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own campaign creatives" ON public.ad_creatives;
CREATE POLICY "Users can update own campaign creatives"
  ON public.ad_creatives FOR UPDATE
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

DROP POLICY IF EXISTS "Users can delete own campaign creatives" ON public.ad_creatives;
CREATE POLICY "Users can delete own campaign creatives"
  ON public.ad_creatives FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ad_campaigns
      WHERE ad_campaigns.id = campaign_id
      AND ad_campaigns.user_id = (select auth.uid())
    )
  );

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

-- Admin policies for ad_creatives
CREATE POLICY "Admin users can view all creatives"
  ON public.ad_creatives FOR SELECT
  TO authenticated
  USING (public.is_admin());

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
CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON public.ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ad_campaign_updated_at();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();