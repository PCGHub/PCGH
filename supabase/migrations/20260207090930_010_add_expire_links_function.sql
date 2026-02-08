/*
  # Add link expiration handling

  1. New Function
    - `expire_stale_links()` - Marks links as 'expired' when their `expires_at` date has passed
    - Also marks associated available/assigned tasks as 'expired'

  2. Changes
    - Adds a callable function that can be invoked periodically or on-demand from the admin dashboard
    - Updates link status from 'active' to 'expired' where expires_at < now()
    - Updates related tasks that are still available/assigned to 'expired'

  3. Notes
    - Safe to run multiple times (idempotent)
    - Only affects links with status = 'active' and expires_at in the past
*/

CREATE OR REPLACE FUNCTION expire_stale_links()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_link_count integer;
  expired_task_count integer;
BEGIN
  WITH expired AS (
    UPDATE links
    SET status = 'expired'
    WHERE status = 'active'
      AND expires_at IS NOT NULL
      AND expires_at < now()
    RETURNING id
  )
  SELECT count(*) INTO expired_link_count FROM expired;

  WITH expired_tasks AS (
    UPDATE tasks
    SET status = 'expired'
    WHERE status IN ('available', 'assigned')
      AND link_id IN (
        SELECT id FROM links WHERE status = 'expired'
      )
    RETURNING id
  )
  SELECT count(*) INTO expired_task_count FROM expired_tasks;

  RETURN json_build_object(
    'expired_links', expired_link_count,
    'expired_tasks', expired_task_count,
    'ran_at', now()
  );
END;
$$;
