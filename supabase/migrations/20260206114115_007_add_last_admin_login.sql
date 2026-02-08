/*
  # Add last_admin_login tracking for granted admins

  1. Modified Tables
    - `users`
      - `last_admin_login` (timestamptz, nullable) - Records when a granted admin last logged into the admin panel

  2. Important Notes
    - This allows the owner to see which granted admins have logged in and when
    - Only updated when a user successfully passes the admin PIN check
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'last_admin_login'
  ) THEN
    ALTER TABLE users ADD COLUMN last_admin_login timestamptz DEFAULT NULL;
  END IF;
END $$;
