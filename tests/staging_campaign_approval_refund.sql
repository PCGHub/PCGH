-- Rollback-only hosted staging acceptance: approve and reject 500-credit campaigns.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at) VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pcgh-staging-creator@example.invalid','',now(),now(),now()),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','00000000-0000-0000-0000-000000000000','authenticated','authenticated','pcgh-staging-admin@example.invalid','',now(),now(),now());
INSERT INTO public.users(id,email,username,credits,is_admin,admin_role) VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1','pcgh-staging-creator@example.invalid','staging_creator',1000,false,null),
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2','pcgh-staging-admin@example.invalid','staging_admin',0,true,'owner');
INSERT INTO public.admin_sessions(user_id,expires_at) VALUES
('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2',now()+interval '30 minutes');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1',true);
DO $test$
DECLARE a jsonb; b jsonb; admin_id uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'; creator_id uuid:='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'; v numeric; r integer; allowance integer; spent numeric;
BEGIN
 a:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1","title":"Approval test","url":"https://example.org/approve","platform":"website","instructions":"Visit and report the result","task_type":"visit"}'::jsonb);
 b:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","title":"Rejection test","url":"https://example.org/reject","platform":"website","instructions":"Visit and report the result","task_type":"visit"}'::jsonb);
 SELECT credits,reserved_credits INTO v,r FROM public.users WHERE id=creator_id;
 IF v<>0 OR r<>1000 THEN RAISE EXCEPTION 'Initial two reservations wrong'; END IF;
 PERFORM set_config('request.jwt.claim.sub',admin_id::text,true);
 IF NOT public.campaign_admin() THEN RAISE EXCEPTION 'Admin session not recognized'; END IF;
 PERFORM public.campaign_action('approve',jsonb_build_object('campaign_id',a->>'id'));
 SELECT credits,reserved_credits,earning_allowance,total_spent_credits INTO v,r,allowance,spent FROM public.users WHERE id=creator_id;
 IF v<>0 OR r<>500 OR allowance<>200 OR spent<>500 THEN RAISE EXCEPTION 'Approval accounting incorrect'; END IF;
 IF (SELECT status FROM public.campaigns WHERE id=(a->>'id')::uuid)<>'active' THEN RAISE EXCEPTION 'Approval status incorrect'; END IF;
 PERFORM public.campaign_action('reject',jsonb_build_object('campaign_id',b->>'id','reason','Staging acceptance rejection'));
 SELECT credits,reserved_credits,earning_allowance,total_spent_credits INTO v,r,allowance,spent FROM public.users WHERE id=creator_id;
 IF v<>500 OR r<>0 OR allowance<>200 OR spent<>500 THEN RAISE EXCEPTION 'Rejection refund accounting incorrect'; END IF;
 IF (SELECT status FROM public.campaigns WHERE id=(b->>'id')::uuid)<>'rejected' OR (SELECT refunded FROM public.campaigns WHERE id=(b->>'id')::uuid)<>500 THEN RAISE EXCEPTION 'Rejection status/refund incorrect'; END IF;
END $test$;
SELECT 'PASS: approval charge and rejection refund' AS result;
ROLLBACK;