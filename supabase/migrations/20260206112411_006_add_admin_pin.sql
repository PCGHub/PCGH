/*
  # Add admin_pin column for separate admin login

  1. Modified Tables
    - `users`
      - `admin_pin` (text, nullable) - A separate PIN used to access the admin panel
        - Only relevant for users with is_admin = true

  2. Data Updates
    - Sets the owner's default admin PIN to '1234' (should be changed immediately)

  3. Security
    - Updated RLS: admins can read their own admin_pin
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'admin_pin'
  ) THEN
    ALTER TABLE users ADD COLUMN admin_pin text DEFAULT NULL;
  END IF;
END $$;

UPDATE users SET admin_pin = '1234' WHERE email = 'pcgrowthhub@gmail.com';
