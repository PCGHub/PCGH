-- Hosted staging transactional campaign reservation acceptance.
-- Synthetic auth/profile data is rolled back at the end.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pcgh-staging-e2e-1@example.invalid','',now(),now(),now());
INSERT INTO public.users(id,email,username,credits)
VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','pcgh-staging-e2e-1@example.invalid','staging_e2e_1',500);
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',true);
DO $check$
DECLARE first_campaign jsonb; second_campaign jsonb; balance numeric; reserved integer;
BEGIN
 first_campaign:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","title":"Staging test","url":"https://example.org/test","platform":"website","instructions":"Visit and report the result","task_type":"visit"}'::jsonb);
 SELECT credits,reserved_credits INTO STRICT balance,reserved FROM public.users WHERE id=auth.uid();
 IF balance<>0 OR reserved<>500 THEN RAISE EXCEPTION '500-credit reservation failed'; END IF;
 second_campaign:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","title":"Staging test","url":"https://example.org/test","platform":"website","instructions":"Visit and report the result","task_type":"visit"}'::jsonb);
 IF second_campaign->>'id' IS DISTINCT FROM first_campaign->>'id' THEN RAISE EXCEPTION 'Idempotent submission mismatch'; END IF;
 IF (SELECT count(*) FROM public.campaigns WHERE user_id=auth.uid())<>1 THEN RAISE EXCEPTION 'Duplicate campaign created'; END IF;
 SELECT credits,reserved_credits INTO STRICT balance,reserved FROM public.users WHERE id=auth.uid();
 IF balance<>0 OR reserved<>500 THEN RAISE EXCEPTION 'Duplicate submission charged again'; END IF;
END $check$;
SELECT 'PASS: 500-credit reservation and idempotent replay' AS result;
ROLLBACK;