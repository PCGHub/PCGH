/*
  # PCGH Core Schema - Phase 1

  1. New Tables:
    - `users` - Extended user profiles with credits and reputation
    - `links` - Submitted links waiting for engagement
    - `tasks` - Individual engagement tasks
    - `task_completions` - Records of completed tasks with proof
    - `credit_transactions` - Ledger of all credit movements
    - `user_pods` - Community pods for engagement distribution
    - `pod_rotations` - Track pod membership history

  2. Security:
    - Enable RLS on all tables
    - Users can only see their own data
    - Service role functions handle system operations

  3. Indexes:
    - Fast queries for task distribution
    - Credit transaction ledger lookups
    - Pod rotation queries
*/

-- Create profiles extension for user metadata
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  username text UNIQUE NOT NULL,
  full_name text,
  credits numeric DEFAULT 0 CHECK (credits >= 0),
  total_earned_credits numeric DEFAULT 0,
  total_spent_credits numeric DEFAULT 0,
  reputation_score integer DEFAULT 0 CHECK (reputation_score >= 0),
  completed_tasks_count integer DEFAULT 0,
  submitted_links_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  last_active_at timestamptz DEFAULT now(),
  joined_at timestamptz DEFAULT now(),
  pod_id uuid,
  pod_rotation_id uuid,
  current_pod_since timestamptz DEFAULT now(),
  tier text DEFAULT 'free' CHECK (tier IN ('free', 'basic', 'pro', 'agency')),
  tier_expires_at timestamptz,
  payment_method text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Links table (user submissions)
CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('website', 'youtube', 'tiktok', 'blog', 'app', 'other')),
  title text,
  description text,
  target_engagement integer DEFAULT 0,
  target_unit text CHECK (target_unit IN ('clicks', 'views', 'installs', 'custom')),
  current_engagement integer DEFAULT 0,
  completed boolean DEFAULT false,
  credits_spent integer DEFAULT 0,
  priority_boost boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired', 'cancelled'))
);

-- Tasks table (individual engagement tasks)
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN ('click', 'view', 'install', 'social_follow', 'social_like', 'social_comment', 'share', 'custom')),
  description text,
  instructions text,
  credit_reward integer NOT NULL,
  assigned_to_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'completed', 'verified', 'rejected', 'expired')),
  assigned_at timestamptz,
  completed_at timestamptz,
  verified_at timestamptz,
  priority_score integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

-- Task completions table (proof of completion)
CREATE TABLE IF NOT EXISTS task_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proof_type text CHECK (proof_type IN ('screenshot', 'link_click', 'video_proof', 'auto_verified')),
  proof_url text,
  notes text,
  verified boolean DEFAULT false,
  verified_by uuid REFERENCES users(id),
  verification_notes text,
  credits_earned integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  verified_at timestamptz
);

-- Credit transactions ledger
CREATE TABLE IF NOT EXISTS credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earned', 'spent', 'refund', 'subscription', 'purchase', 'bonus', 'penalty')),
  description text,
  related_task_id uuid REFERENCES tasks(id),
  related_link_id uuid REFERENCES links(id),
  balance_before integer,
  balance_after integer,
  created_at timestamptz DEFAULT now()
);

-- User pods for engagement distribution
CREATE TABLE IF NOT EXISTS user_pods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_number integer UNIQUE,
  max_members integer DEFAULT 250,
  current_members_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Pod rotation history
CREATE TABLE IF NOT EXISTS pod_rotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_date date DEFAULT CURRENT_DATE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  old_pod_id uuid REFERENCES user_pods(id),
  new_pod_id uuid NOT NULL REFERENCES user_pods(id),
  created_at timestamptz DEFAULT now()
);

-- Payment records
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_naira numeric NOT NULL,
  credits_purchased integer NOT NULL,
  payment_method text NOT NULL,
  provider text NOT NULL DEFAULT 'paystack',
  provider_reference text UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE links ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pods ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_rotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can read own profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for links table
CREATE POLICY "Users can read own links"
  ON links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own links"
  ON links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own links"
  ON links FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for tasks
CREATE POLICY "Users can read available tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    status = 'available' 
    OR user_id = auth.uid() 
    OR assigned_to_user_id = auth.uid()
  );

-- RLS Policies for task completions
CREATE POLICY "Users can read own completions"
  ON task_completions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert completions"
  ON task_completions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for credit transactions
CREATE POLICY "Users can read own transactions"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for user pods (readable by all authenticated users)
CREATE POLICY "All users can read pods"
  ON user_pods FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for pod rotations
CREATE POLICY "Users can read own rotations"
  ON pod_rotations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for payments
CREATE POLICY "Users can read own payments"
  ON payments FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert payments"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_pod_id ON users(pod_id);
CREATE INDEX idx_links_user_id ON links(user_id);
CREATE INDEX idx_links_status ON links(status);
CREATE INDEX idx_links_created_at ON links(created_at);
CREATE INDEX idx_tasks_link_id ON tasks(link_id);
CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to_user_id);
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_priority_score ON tasks(priority_score DESC);
CREATE INDEX idx_tasks_created_at ON tasks(created_at);
CREATE INDEX idx_task_completions_task_id ON task_completions(task_id);
CREATE INDEX idx_task_completions_user_id ON task_completions(user_id);
CREATE INDEX idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX idx_pod_rotations_user_id ON pod_rotations(user_id);
CREATE INDEX idx_pod_rotations_rotation_date ON pod_rotations(rotation_date);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
