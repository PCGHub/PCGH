-- Guided plans use the existing campaign ownership and RLS policies.
-- Support both the campaign fields used by the UI and those in migration 011.
ALTER TABLE public.ad_campaigns
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS objective text,
  ADD COLUMN IF NOT EXISTS budget_type text NOT NULL DEFAULT 'daily',
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN',
  ADD COLUMN IF NOT EXISTS ad_copy text,
  ADD COLUMN IF NOT EXISTS demand_gen_plan jsonb;

ALTER TABLE public.ad_campaigns
  ADD CONSTRAINT ad_campaigns_demand_gen_plan_format
  CHECK (
    demand_gen_plan IS NULL OR (
      platform = 'google'
      AND status = 'draft'
      AND jsonb_typeof(demand_gen_plan) = 'object'
    )
  );
