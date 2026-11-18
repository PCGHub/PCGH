-- Isolated staging negative-path authentication acceptance.
-- Run with a synthetic UUID that is not an auth.users member.
-- Transaction rollback ensures no lasting changes.
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
DO $test$
DECLARE result jsonb;
BEGIN
 IF public.campaign_admin() THEN RAISE EXCEPTION 'Unknown user unexpectedly admin'; END IF;
 BEGIN
  result:=public.campaign_action('admin_login','{"pin":"123456"}'::jsonb);
  RAISE EXCEPTION 'Unknown user login unexpectedly succeeded';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Active membership required%' THEN RAISE; END IF;
 END;
 BEGIN
  result:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa","title":"test"}'::jsonb);
  RAISE EXCEPTION 'Unknown user submitted campaign';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%Active membership required%' THEN RAISE; END IF;
 END;
END $test$;
ROLLBACK;