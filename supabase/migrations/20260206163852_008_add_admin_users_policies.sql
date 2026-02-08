/*
  # Add admin RLS policies for users table

  1. Security Changes
    - Add admin SELECT policy on `users` so admins can read all user profiles
    - Add admin UPDATE policy on `users` so the owner can grant/revoke access and change PINs

  2. Important Notes
    - Without these policies, admins could only see their own profile
    - The search in Access Control was failing because RLS blocked reading other users
*/

CREATE POLICY "Admins can read all users"
  ON users FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can update all users"
  ON users FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
