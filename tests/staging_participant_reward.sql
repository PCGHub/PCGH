-- Rollback-only staging task reward acceptance. Synthetic profiles and simulated authenticated JWT subjects.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
SELECT id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated',email,'',now(),now(),now()
FROM (VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,'staging-creator@example.invalid'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'::uuid,'staging-worker@example.invalid'),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'::uuid,'staging-admin@example.invalid')
) AS x(id,email);
INSERT INTO public.users(id,email,username,credits,earning_allowance,is_admin,admin_role) VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','staging-creator@example.invalid','stage_creator',500,0,false,null),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','staging-worker@example.invalid','stage_worker',0,200,false,null),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3','staging-admin@example.invalid','stage_admin',0,0,true,'owner');
INSERT INTO public.admin_sessions(user_id,expires_at) VALUES('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3',now()+interval '30 minutes');
SET LOCAL ROLE authenticated;
DO $test$
DECLARE creator uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'; worker uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'; admin uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'; campaign jsonb; claim jsonb; v numeric; reserved integer; allowance integer; earned numeric; distributed integer; verified integer; status text;
BEGIN
 PERFORM set_config('request.jwt.claim.sub',creator::text,true);
 campaign:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","title":"Reward test","url":"https://example.org/reward","platform":"website","instructions":"Visit and report the result","task_type":"visit"}'::jsonb);
 PERFORM set_config('request.jwt.claim.sub',admin::text,true);
 PERFORM public.campaign_action('approve',jsonb_build_object('campaign_id',campaign->>'id'));
 PERFORM public.campaign_action('distribute',jsonb_build_object('campaign_id',campaign->>'id','audience','community','recipients','[]'::jsonb,'group_ids','[]'::jsonb));
 PERFORM set_config('request.jwt.claim.sub',creator::text,true);
 BEGIN
  PERFORM public.campaign_action('start',jsonb_build_object('campaign_id',campaign->>'id'));
  RAISE EXCEPTION 'Creator earned on own campaign';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Creator earned on own campaign' THEN RAISE; END IF; END;
 PERFORM set_config('request.jwt.claim.sub',worker::text,true);
 claim:=public.campaign_action('start',jsonb_build_object('campaign_id',campaign->>'id'));
 IF (public.campaign_action('start',jsonb_build_object('campaign_id',campaign->>'id'))->>'id') IS DISTINCT FROM claim->>'id' THEN RAISE EXCEPTION 'Duplicate claim created'; END IF;
 SELECT earning_reserved INTO reserved FROM public.users WHERE id=worker;
 IF reserved<>2 THEN RAISE EXCEPTION 'Claim reservation incorrect'; END IF;
 PERFORM public.campaign_action('evidence',jsonb_build_object('claim_id',claim->>'id','evidence','Verified staging test task completion evidence'));
 PERFORM set_config('request.jwt.claim.sub',admin::text,true);
 PERFORM public.campaign_action('review',jsonb_build_object('claim_id',claim->>'id','approved',true));
 SELECT credits,earning_reserved,earning_allowance,total_earned_credits INTO v,reserved,allowance,earned FROM public.users WHERE id=worker;
 SELECT c.distributed,c.verified_count INTO distributed,verified FROM public.campaigns c WHERE c.id=(campaign->>'id')::uuid;
 IF v<>2 OR reserved<>0 OR allowance<>198 OR earned<>2 OR distributed<>2 OR verified<>1 THEN RAISE EXCEPTION 'Verified reward accounting incorrect'; END IF;
 BEGIN
  PERFORM public.campaign_action('review',jsonb_build_object('claim_id',claim->>'id','approved',true));
  RAISE EXCEPTION 'Duplicate review accepted';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM='Duplicate review accepted' THEN RAISE; END IF; END;
 SELECT credits INTO v FROM public.users WHERE id=worker;
 IF v<>2 THEN RAISE EXCEPTION 'Duplicate review credited twice'; END IF;
END $test$;
SELECT 'PASS: owner exclusion, idempotent claim, evidence, 2-credit verified reward, duplicate review rejection' AS result;
ROLLBACK;