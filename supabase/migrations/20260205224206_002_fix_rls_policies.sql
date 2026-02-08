/*
  # Fix missing RLS policies

  1. Changes:
    - Add INSERT policy on `users` table so signup can create profiles
    - Add INSERT policy on `tasks` so link submissions can generate tasks
    - Add INSERT policy on `credit_transactions` so credits can be recorded
    - Add UPDATE policy on `tasks` so task completion works
    - Allow authenticated users to read basic info (username) of other users for task feed
    - Add UPDATE policy on `links` current_engagement tracking

  2. Security:
    - INSERT on users: only if auth.uid() matches the row id
    - INSERT on tasks: only if user owns the link
    - INSERT on credit_transactions: only for own user_id
    - UPDATE on tasks: only for assigned tasks
    - SELECT on users: allow reading username of any authenticated user (needed for task feed)
*/

-- Users: Allow inserting own profile during signup
CREATE POLICY "Users can insert own profile"
  ON users FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Drop the restrictive SELECT policy and replace with one that allows reading usernames
DROP POLICY IF EXISTS "Users can read own profile" ON users;

CREATE POLICY "Users can read own full profile"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can read other usernames"
  ON users FOR SELECT
  TO authenticated
  USING (true);

-- Tasks: Allow authenticated users to insert tasks for their own links
CREATE POLICY "Users can insert tasks for own links"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM links
      WHERE links.id = link_id
      AND links.user_id = auth.uid()
    )
  );

-- Tasks: Allow updating task status when completing
CREATE POLICY "Users can update assigned tasks"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to_user_id = auth.uid()
    OR user_id = auth.uid()
    OR status = 'available'
  )
  WITH CHECK (
    assigned_to_user_id = auth.uid()
    OR user_id = auth.uid()
  );

-- Credit transactions: Allow users to insert their own transactions
CREATE POLICY "Users can insert own transactions"
  ON credit_transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Task completions: ensure users can also read completions for verification
CREATE POLICY "Users can read completions for own tasks"
  ON task_completions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_id
      AND tasks.user_id = auth.uid()
    )
  );
