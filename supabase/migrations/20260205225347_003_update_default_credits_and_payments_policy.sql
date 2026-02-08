/*
  # Update default credits and payment policies

  1. Changes:
    - Update default free credits from 20 to 150 for new users
    - Add UPDATE policy on payments table for completing payment records

  2. Security:
    - Payment UPDATE restricted to own records only
*/

ALTER TABLE users ALTER COLUMN credits SET DEFAULT 150;

CREATE POLICY "Users can update own payments"
  ON payments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
