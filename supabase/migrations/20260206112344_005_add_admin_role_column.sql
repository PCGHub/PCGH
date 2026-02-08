/*
  # Add admin_role column to users table

  1. Modified Tables
    - `users`
      - `admin_role` (text, nullable) - Distinguishes admin types:
        - 'owner' = Boss Victor (PCGH), the platform owner
        - 'granted' = Users who have been granted admin access by the owner
        - NULL = Not an admin (even if is_admin is true, this refines the role)

  2. Data Updates
    - Sets the existing admin user (Boss Victor) to admin_role = 'owner'

  3. Important Notes
    - is_admin remains the gate for admin access
    - admin_role determines the experience/welcome message
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'admin_role'
  ) THEN
    ALTER TABLE users ADD COLUMN admin_role text DEFAULT NULL;
  END IF;
END $$;

UPDATE users SET admin_role = 'owner' WHERE email = 'pcgrowthhub@gmail.com';
