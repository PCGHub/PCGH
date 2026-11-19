BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
SELECT ('eeeeeeee-eeee-4eee-8eee-'||lpad(to_hex(n),12,'0'))::uuid,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','cap'||n||'@example.invalid','',now(),now(),now() FROM generate_series(1,103) n;
INSERT INTO public.users(id,email,username,credits,earning_allowance,is_admin,admin_role)
SELECT ('eeeeeeee-eeee-4eee-8eee-'||lpad(to_hex(n),12,'0'))::uuid,'cap'||n||'@example.invalid','cap_'||n,CASE WHEN n=1 THEN 500 ELSE 0 END,CASE WHEN n BETWEEN 3 AND 103 THEN 200 ELSE 0 END,n=2,CASE WHEN n=2 THEN 'owner' END FROM generate_series(1,103) n;
INSERT INTO public.admin_sessions(user_id,expires_at) VALUES ('eeeeeeee-eeee-4eee-8eee-000000000002',now()+interval '30 minutes');
SET LOCAL ROLE authenticated;
DO $test$
DECLARE c jsonb; q jsonb; n int; cnt int; failmsg text; worker uuid;
BEGIN
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-000000000001',true);
 c:=public.campaign_action('submit','{"request_id":"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2","title":"Capacity test","url":"https://example.org/test","platform":"website","instructions":"Verify the task","task_type":"visit"}'::jsonb);
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-000000000002',true);
 PERFORM public.campaign_action('approve',jsonb_build_object('campaign_id',c->>'id'));
 PERFORM public.campaign_action('distribute',jsonb_build_object('campaign_id',c->>'id','audience','community','recipients','[]'::jsonb,'group_ids','[]'::jsonb));
 FOR n IN 3..102 LOOP
  worker:=('eeeeeeee-eeee-4eee-8eee-'||lpad(to_hex(n),12,'0'))::uuid;
  PERFORM set_config('request.jwt.claim.sub',worker::text,true);
  q:=public.campaign_action('start',jsonb_build_object('campaign_id',c->>'id'));
  IF q->>'status'<>'in_progress' THEN RAISE EXCEPTION 'Slot % failed',n; END IF;
 END LOOP;
 SELECT count(*) INTO cnt FROM public.campaign_claims WHERE campaign_id=(c->>'id')::uuid;
 IF cnt<>100 THEN RAISE EXCEPTION 'Expected 100 claims, got %',cnt; END IF;
 PERFORM set_config('request.jwt.claim.sub','eeeeeeee-eeee-4eee-8eee-000000000067',true);
 BEGIN
  PERFORM public.campaign_action('start',jsonb_build_object('campaign_id',c->>'id'));
  RAISE EXCEPTION '101st claim unexpectedly accepted';
 EXCEPTION WHEN OTHERS THEN
  failmsg:=SQLERRM;
  IF failmsg='101st claim unexpectedly accepted' OR failmsg NOT LIKE '%slots are reserved%' THEN RAISE EXCEPTION 'Unexpected 101st claim outcome: %',failmsg; END IF;
 END;
END $test$;
SELECT 'PASS: 100 reserved task slots, 101st claimant rejected' AS result;
ROLLBACK;