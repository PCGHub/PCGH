-- PCGH Crowd staging: non-mutating database acceptance assertions.
-- Execute only against isolated staging project hsicgiikaemesqrdltsh.
-- Fails fast if a core security/economy invariant is violated.
DO $check$
BEGIN
 IF (SELECT column_default FROM information_schema.columns
     WHERE table_schema='public' AND table_name='users' AND column_name='credits') <> '0'
 THEN RAISE EXCEPTION 'Signup credit default must be zero'; END IF;
 IF has_table_privilege('authenticated','public.payments','UPDATE')
    OR has_table_privilege('authenticated','public.payments','INSERT')
 THEN RAISE EXCEPTION 'Authenticated role can write legacy payments'; END IF;
 IF has_column_privilege('authenticated','public.users','credits','UPDATE')
    OR has_column_privilege('authenticated','public.users','is_admin','UPDATE')
    OR has_column_privilege('authenticated','public.users','admin_pin','SELECT')
 THEN RAISE EXCEPTION 'Profile sensitive column permissions too broad'; END IF;
 IF has_function_privilege('anon','public.campaign_action(text,jsonb)','EXECUTE')
    OR has_function_privilege('authenticated','public.settle_credit_order(text,text,numeric,text)','EXECUTE')
 THEN RAISE EXCEPTION 'Privileged economy RPC exposed'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_policies
   WHERE schemaname='public' AND tablename='payments'
     AND cmd IN ('INSERT','UPDATE','DELETE')
 ) THEN RAISE EXCEPTION 'Legacy payment write RLS policy present'; END IF;
 IF EXISTS (
   SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('expire_stale_links','update_ad_campaign_updated_at','update_updated_at_column')
     AND has_function_privilege('anon',p.oid,'EXECUTE')
 ) THEN RAISE EXCEPTION 'Anonymous legacy maintenance RPC exposed'; END IF;
END
$check$;
SELECT 'PASS: static staging acceptance assertions' AS result;