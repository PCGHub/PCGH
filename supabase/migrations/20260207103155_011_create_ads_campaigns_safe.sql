/*
  # Create Ads Campaign Management System

  1. New Tables
    - `ad_campaigns`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text) - Campaign name
      - `platform` (text) - Advertising platform (facebook, instagram, google, tiktok, etc.)
      - `objective` (text) - Campaign objective (brand_awareness, traffic, conversions, etc.)
      - `budget` (numeric) - Campaign budget
      - `budget_type` (text) - daily or lifetime
      - `start_date` (date) - Campaign start date
      - `end_date` (date) - Campaign end date (optional)
      - `target_audience` (jsonb) - Audience targeting parameters
      - `ad_creative` (jsonb) - Ad creative details (copy, images, videos)
      - `tracking_link` (text) - UTM tracking link
      - `status` (text) - draft, active, paused, completed
      - `notes` (text) - Campaign notes and learnings
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `ad_campaign_metrics`
      - `id` (uuid, primary key)
      - `campaign_id` (uuid, references ad_campaigns)
      - `date` (date) - Metrics date
      - `impressions` (integer) - Number of impressions
      - `clicks` (integer) - Number of clicks
      - `spend` (numeric) - Amount spent
      - `conversions` (integer) - Number of conversions
      - `revenue` (numeric) - Revenue generated
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only view and manage their own campaigns
    - Users can only view metrics for their own campaigns
*/

-- Create ad_campaigns table
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  platform text NOT NULL,
  objective text NOT NULL,
  budget numeric NOT NULL DEFAULT 0,
  budget_type text NOT NULL DEFAULT 'daily',
  start_date date NOT NULL,
  end_date date,
  target_audience jsonb DEFAULT '{}'::jsonb,
  ad_creative jsonb DEFAULT '{}'::jsonb,
  tracking_link text,
  status text NOT NULL DEFAULT 'draft',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ad_campaign_metrics table
CREATE TABLE IF NOT EXISTS ad_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
  date date NOT NULL,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  spend numeric DEFAULT 0,
  conversions integer DEFAULT 0,
  revenue numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, date)
);

-- Enable RLS
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaign_metrics ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Users can create own campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Users can delete own campaigns" ON ad_campaigns;
DROP POLICY IF EXISTS "Users can view own campaign metrics" ON ad_campaign_metrics;
DROP POLICY IF EXISTS "Users can create metrics for own campaigns" ON ad_campaign_metrics;
DROP POLICY IF EXISTS "Users can update metrics for own campaigns" ON ad_campaign_metrics;

-- Policies for ad_campaigns
CREATE POLICY "Users can view own campaigns"
  ON ad_campaigns FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own campaigns"
  ON ad_campaigns FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own campaigns"
  ON ad_campaigns FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own campaigns"
  ON ad_campaigns FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policies for ad_campaign_metrics
CREATE POLICY "Users can view own campaign metrics"
  ON ad_campaign_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_campaign_metrics.campaign_id
      AND ad_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create metrics for own campaigns"
  ON ad_campaign_metrics FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_campaign_metrics.campaign_id
      AND ad_campaigns.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update metrics for own campaigns"
  ON ad_campaign_metrics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_campaign_metrics.campaign_id
      AND ad_campaigns.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ad_campaigns
      WHERE ad_campaigns.id = ad_campaign_metrics.campaign_id
      AND ad_campaigns.user_id = auth.uid()
    )
  );

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_user_id ON ad_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status ON ad_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_campaign_id ON ad_campaign_metrics(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ad_campaign_metrics_date ON ad_campaign_metrics(date);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_ad_campaigns_updated_at ON ad_campaigns;
CREATE TRIGGER update_ad_campaigns_updated_at
  BEFORE UPDATE ON ad_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();