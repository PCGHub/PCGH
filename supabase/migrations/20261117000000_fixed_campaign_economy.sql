-- New campaigns use a versioned ledger; legacy campaigns/transactions remain untouched.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

ALTER TABLE public.users
 ADD COLUMN IF NOT EXISTS reserved_credits integer NOT NULL DEFAULT 0
 CHECK (reserved_credits >= 0);

ALTER TABLE public.users
 ADD COLUMN IF NOT EXISTS earning_allowance integer NOT NULL DEFAULT 0
 CHECK (earning_allowance >= 0);

ALTER TABLE public.users
 ADD COLUMN IF NOT EXISTS earning_reserved integer NOT NULL DEFAULT 0
 CHECK (earning_reserved >= 0);

ALTER TABLE public.users
 ADD COLUMN IF NOT EXISTS earning_unlocked integer NOT NULL DEFAULT 0;

-- Bridge the checked-in ad planner's title fields with the historical name schema.
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.ad_campaigns
 ADD COLUMN IF NOT EXISTS objective text DEFAULT 'traffic';
ALTER TABLE public.ad_campaigns
 ADD COLUMN IF NOT EXISTS currency text DEFAULT 'NGN';
ALTER TABLE public.ad_campaigns ADD COLUMN IF NOT EXISTS ad_copy text;

UPDATE public.ad_campaigns
 SET title=coalesce(title,name),name=coalesce(name,title);

CREATE TABLE public.campaigns (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES public.users(id),
 request_id uuid NOT NULL,

 title text NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 url text NOT NULL CHECK(url ~ '^https?://[^[:space:]]+'),
 platform text NOT NULL,
 instructions text NOT NULL CHECK(length(instructions) BETWEEN 10 AND 3000),

 task_type text NOT NULL CHECK(task_type IN ('visit','feedback')),

 status text NOT NULL DEFAULT 'pending_approval'
 CHECK(status IN (
  'pending_approval','active','settling','completed','expired','rejected'
 )),

 price integer NOT NULL DEFAULT 500 CHECK(price=500),
 platform_fee integer NOT NULL DEFAULT 300 CHECK(platform_fee=300),
 reward_pool integer NOT NULL DEFAULT 200 CHECK(reward_pool=200),
 reward integer NOT NULL DEFAULT 2 CHECK(reward=2),
 target integer NOT NULL DEFAULT 100 CHECK(target=100),

 verified_count integer NOT NULL DEFAULT 0
 CHECK(verified_count BETWEEN 0 AND 100),

 distributed integer NOT NULL DEFAULT 0
 CHECK(distributed BETWEEN 0 AND 200),

 refunded integer NOT NULL DEFAULT 0
 CHECK(refunded BETWEEN 0 AND 500),

 audience text NOT NULL DEFAULT 'community'
 CHECK(audience IN ('community','individuals','groups')),

 recipients uuid[] NOT NULL DEFAULT '{}',
 group_ids uuid[] NOT NULL DEFAULT '{}',

 reason text,
 created_at timestamptz NOT NULL DEFAULT now(),
 approved_at timestamptz,
 expires_at timestamptz,
 closed_at timestamptz,

 UNIQUE(user_id,request_id)
);

CREATE TABLE public.campaign_claims (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id),
 user_id uuid NOT NULL REFERENCES public.users(id),

 status text NOT NULL DEFAULT 'in_progress'
 CHECK(status IN (
  'in_progress','pending_verification','verified','rejected','expired'
 )),

 reward integer NOT NULL DEFAULT 2 CHECK(reward=2),
 evidence text,
 reason text,

 created_at timestamptz NOT NULL DEFAULT now(),
 deadline timestamptz NOT NULL,
 submitted_at timestamptz,
 reviewed_at timestamptz,
 reviewer uuid REFERENCES public.users(id),

 UNIQUE(campaign_id,user_id)
);

CREATE TABLE public.wallet_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.users(id),

 kind text NOT NULL,
 amount numeric NOT NULL,
 reserved_delta integer NOT NULL DEFAULT 0,

 balance_after numeric NOT NULL,
 reserved_after integer NOT NULL,
 description text NOT NULL,

 campaign_id uuid REFERENCES public.campaigns(id),
 claim_id uuid REFERENCES public.campaign_claims(id),

 reference text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.admin_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 actor uuid REFERENCES public.users(id),
 action text NOT NULL,
 campaign_id uuid,
 claim_id uuid,
 detail text,
 created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.campaign_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 campaign_id uuid NOT NULL REFERENCES public.campaigns(id),
 user_id uuid NOT NULL REFERENCES public.users(id),
 reason text NOT NULL,
 created_at timestamptz DEFAULT now(),

 UNIQUE(campaign_id,user_id)
);

CREATE TABLE public.credit_orders (
 reference text PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES public.users(id),

 credits integer NOT NULL CHECK(credits BETWEEN 100 AND 100000),
 amount_naira integer NOT NULL,

 status text DEFAULT 'pending' CHECK(status IN ('pending','completed')),
 provider_id text UNIQUE,
 created_at timestamptz DEFAULT now(),
 completed_at timestamptz
);

CREATE INDEX campaigns_owner_date
 ON public.campaigns(user_id,created_at DESC);

CREATE INDEX campaigns_expiry
 ON public.campaigns(status,expires_at);

CREATE INDEX claims_campaign_status
 ON public.campaign_claims(campaign_id,status);

CREATE INDEX claims_member
 ON public.campaign_claims(user_id,created_at DESC);

CREATE INDEX wallet_member_date
 ON public.wallet_events(user_id,created_at DESC);

CREATE TABLE public.admin_sessions (
 user_id uuid PRIMARY KEY REFERENCES public.users(id),
 pin_hash text,
 attempts integer NOT NULL DEFAULT 0,
 locked_until timestamptz,
 expires_at timestamptz
);

-- Preserve existing PINs as hashes without exposing them through profile reads.
INSERT INTO public.admin_sessions(user_id,pin_hash)
 SELECT id,extensions.crypt(admin_pin,extensions.gen_salt('bf'))
 FROM public.users
 WHERE is_admin AND admin_pin IS NOT NULL;

UPDATE public.users
 SET admin_pin=NULL
 WHERE admin_pin IS NOT NULL;

CREATE FUNCTION public.campaign_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
 SELECT EXISTS(
  SELECT 1
  FROM users u
  JOIN admin_sessions s ON s.user_id=u.id
  WHERE u.id=auth.uid()
   AND u.is_admin
   AND u.is_active
   AND s.expires_at>now()
 )
$$;

-- Owners see aggregate progress, never other participants' private evidence.
CREATE FUNCTION public.campaign_progress()
RETURNS TABLE(
 campaign_id uuid,
 pending_claims bigint,
 started_claims bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
 SELECT
  c.id,
  count(q.id) FILTER(WHERE q.status='pending_verification'),
  count(q.id) FILTER(WHERE q.status='in_progress')
 FROM campaigns c
 LEFT JOIN campaign_claims q ON q.campaign_id=c.id
 WHERE c.user_id=auth.uid() OR campaign_admin()
 GROUP BY c.id
$$;

REVOKE ALL ON FUNCTION public.campaign_progress() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.campaign_progress() TO authenticated;

CREATE FUNCTION public.wallet_event(
 p_user uuid,
 p_kind text,
 p_amount integer,
 p_reserved integer,
 p_description text,
 p_campaign uuid DEFAULT NULL,
 p_claim uuid DEFAULT NULL,
 p_reference text DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
 INSERT INTO wallet_events(
  user_id,
  kind,
  amount,
  reserved_delta,
  balance_after,
  reserved_after,
  description,
  campaign_id,
  claim_id,
  reference
 )
 SELECT
  p_user,
  p_kind,
  p_amount,
  p_reserved,
  credits,
  reserved_credits,
  p_description,
  p_campaign,
  p_claim,
  p_reference
 FROM users
 WHERE id=p_user
$$;

REVOKE ALL ON FUNCTION public.wallet_event(
 uuid,text,integer,integer,text,uuid,uuid,text
) FROM PUBLIC,anon,authenticated;

-- Limit browser access to profile fields. All financial mutations use the RPC below.
REVOKE ALL ON public.users FROM anon,authenticated;

GRANT SELECT(
 id,
 email,
 username,
 full_name,
 credits,
 reserved_credits,
 earning_allowance,
 earning_reserved,
 earning_unlocked,
 total_earned_credits,
 total_spent_credits,
 reputation_score,
 completed_tasks_count,
 submitted_links_count,
 is_active,
 joined_at,
 is_admin,
 admin_role,
 pod_id
) ON public.users TO authenticated;

GRANT UPDATE(full_name,username) ON public.users TO authenticated;

DO $$
DECLARE p record;
BEGIN
 FOR p IN
  SELECT policyname
  FROM pg_policies
  WHERE schemaname='public' AND tablename='users'
 LOOP
  EXECUTE format('DROP POLICY %I ON public.users',p.policyname);
 END LOOP;
END
$$;

CREATE POLICY profile_read
 ON public.users
 FOR SELECT
 TO authenticated
 USING(id=auth.uid() OR public.campaign_admin());

CREATE POLICY profile_edit
 ON public.users
 FOR UPDATE
 TO authenticated
 USING(id=auth.uid())
 WITH CHECK(id=auth.uid());

-- Close legacy browser write paths. Historical data stays readable under existing RLS.
REVOKE INSERT,UPDATE,DELETE
 ON public.links,
    public.tasks,
    public.task_completions,
    public.credit_transactions,
    public.payments
 FROM anon,authenticated;

DO $$
DECLARE t text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
  'campaigns',
  'campaign_claims',
  'wallet_events',
  'admin_events',
  'campaign_reports',
  'credit_orders',
  'admin_sessions'
 ]
 LOOP
  EXECUTE format(
   'ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t
  );

  EXECUTE format(
   'REVOKE ALL ON public.%I FROM anon,authenticated',t
  );
 END LOOP;
END
$$;

GRANT ALL
 ON public.campaigns,
    public.campaign_claims,
    public.wallet_events,
    public.admin_events,
    public.campaign_reports,
    public.credit_orders,
    public.admin_sessions
 TO service_role;

GRANT USAGE,SELECT
 ON SEQUENCE public.wallet_events_id_seq,
             public.admin_events_id_seq
 TO service_role;

GRANT SELECT
 ON public.campaigns,
    public.campaign_claims,
    public.wallet_events,
    public.admin_events,
    public.campaign_reports,
    public.credit_orders
 TO authenticated;

CREATE POLICY campaign_read
 ON public.campaigns
 FOR SELECT
 TO authenticated
 USING(
  user_id=auth.uid()
  OR public.campaign_admin()
  OR (
   status='active'
   AND expires_at>now()
   AND (
    audience='community'
    OR auth.uid()=ANY(recipients)
    OR (audience='groups' AND EXISTS(
     SELECT 1
     FROM users
     WHERE id=auth.uid() AND pod_id IS NOT NULL AND pod_id=ANY(group_ids)
    ))
   )
  )
  OR EXISTS(
   SELECT 1
   FROM campaign_claims
   WHERE campaign_id=campaigns.id AND user_id=auth.uid()
  )
 );

CREATE POLICY claim_read
 ON public.campaign_claims
 FOR SELECT
 TO authenticated
 USING(user_id=auth.uid() OR public.campaign_admin());

CREATE POLICY wallet_read
 ON public.wallet_events
 FOR SELECT
 TO authenticated
 USING(user_id=auth.uid() OR public.campaign_admin());

CREATE POLICY audit_read
 ON public.admin_events
 FOR SELECT
 TO authenticated
 USING(public.campaign_admin());

CREATE POLICY report_read
 ON public.campaign_reports
 FOR SELECT
 TO authenticated
 USING(user_id=auth.uid() OR public.campaign_admin());

CREATE POLICY order_read
 ON public.credit_orders
 FOR SELECT
 TO authenticated
 USING(user_id=auth.uid() OR public.campaign_admin());

CREATE FUNCTION public.campaign_maintenance()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
 x record;
 n integer;
BEGIN
 PERFORM pg_advisory_xact_lock(5100500200);

 FOR x IN
  UPDATE campaign_claims
  SET status='expired'
  WHERE status='in_progress' AND deadline<=now()
  RETURNING *
 LOOP
  UPDATE users
  SET earning_reserved=earning_reserved-x.reward
  WHERE id=x.user_id;
 END LOOP;

 UPDATE campaigns
 SET status='settling'
 WHERE status='active'
  AND (expires_at<=now() OR verified_count=100);

 FOR x IN
  SELECT *
  FROM campaigns c
  WHERE status='settling'
   AND NOT EXISTS(
    SELECT 1
    FROM campaign_claims q
    WHERE q.campaign_id=c.id
     AND q.status IN ('in_progress','pending_verification')
   )
  FOR UPDATE
 LOOP
  n:=200-x.distributed;

  UPDATE campaigns
  SET
   status=CASE
    WHEN verified_count=100 THEN 'completed'
    ELSE 'expired'
   END,
   refunded=n,
   closed_at=now()
  WHERE id=x.id;

  IF n>0 THEN
   UPDATE users
   SET credits=credits+n
   WHERE id=x.user_id;

   PERFORM wallet_event(
    x.user_id,
    'refund',
    n,
    0,
    'Unused campaign reward pool returned',
    x.id
   );
  END IF;

  INSERT INTO admin_events(action,campaign_id,detail)
  VALUES(
   'automatic_settlement',
   x.id,
   n||' unused reward credits returned'
  );
 END LOOP;
END
$$;

REVOKE ALL ON FUNCTION public.campaign_maintenance()
 FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.campaign_maintenance()
 TO service_role;

CREATE FUNCTION public.campaign_action(
 action text,
 payload jsonb DEFAULT '{}'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE
 uid uuid:=auth.uid();
 u users;
 c campaigns;
 q campaign_claims;
 a admin_sessions;
 n integer;
 result jsonb;
 cid uuid;
 approved boolean;
 reason text;
 x record;
BEGIN
 IF uid IS NULL THEN
  RAISE EXCEPTION 'Authentication required';
 END IF;

 -- One lock order for all economy writes, including payment settlement. A small launch
 -- community favors correctness over throughput; replace with ordered row locks at scale.
 PERFORM pg_advisory_xact_lock(5100500200);

 SELECT *
 INTO u
 FROM users
 WHERE id=uid
 FOR UPDATE;

 IF action='ensure_profile' THEN
  IF u.id IS NULL THEN
   INSERT INTO users(
    id,email,username,full_name,credits
   )
   SELECT
    id,
    email,
    coalesce(
     nullif(raw_user_meta_data->>'username',''),
     'member_'||substr(id::text,1,8)
    ),
    coalesce(raw_user_meta_data->>'full_name',''),
    0
   FROM auth.users
   WHERE id=uid
   RETURNING * INTO u;
  END IF;

  RETURN jsonb_build_object('ok',true);
 END IF;

 IF u.id IS NULL OR NOT u.is_active THEN
  RAISE EXCEPTION 'Active membership required';
 END IF;

 IF action='admin_login' THEN
  IF NOT u.is_admin THEN
   RAISE EXCEPTION 'Admin access required';
  END IF;

  SELECT *
  INTO a
  FROM admin_sessions
  WHERE user_id=uid
  FOR UPDATE;

  IF a.locked_until>now() THEN
   RETURN jsonb_build_object(
    'error',
    'Too many attempts. Try again in 15 minutes.'
   );
  END IF;

  IF a.pin_hash IS NULL
   OR nullif(btrim(payload->>'pin'),'') IS NULL
   OR a.pin_hash IS DISTINCT FROM extensions.crypt(payload->>'pin',a.pin_hash)
  THEN
   UPDATE admin_sessions
   SET
    attempts=attempts+1,
    locked_until=CASE
     WHEN attempts+1>=5 THEN now()+interval '15 minutes'
    END,
    expires_at=NULL
   WHERE user_id=uid;

   RETURN jsonb_build_object(
    'error',
    'Incorrect admin PIN or PIN not configured.'
   );
  END IF;

  UPDATE admin_sessions
  SET
   attempts=0,
   locked_until=NULL,
   expires_at=now()+interval '30 minutes'
  WHERE user_id=uid;

  RETURN jsonb_build_object('ok',true);

 ELSIF action='admin_logout' THEN
  UPDATE admin_sessions
  SET expires_at=NULL
  WHERE user_id=uid;

  RETURN '{"ok":true}';
 END IF;

 IF action IN (
  'approve',
  'reject',
  'distribute',
  'review',
  'settle',
  'access',
  'adjust',
  'admin_pin',
  'manage_admin'
 ) AND NOT campaign_admin()
 THEN
  RAISE EXCEPTION 'Admin session expired or access denied';
 END IF;

 IF action='admin_pin' THEN
  IF length(payload->>'pin')<6 THEN
   RAISE EXCEPTION 'PIN needs at least 6 characters';
  END IF;

  UPDATE admin_sessions
  SET pin_hash=extensions.crypt(
   payload->>'pin',
   extensions.gen_salt('bf')
  )
  WHERE user_id=uid;

  RETURN '{"ok":true}';
 END IF;

 PERFORM campaign_maintenance();

 SELECT *
 INTO u
 FROM users
 WHERE id=uid;

 IF action='refresh' THEN
  RETURN '{"ok":true}';
 END IF;

 IF action='submit' THEN
  SELECT *
  INTO c
  FROM campaigns
  WHERE user_id=uid
   AND request_id=(payload->>'request_id')::uuid;

  IF c.id IS NOT NULL THEN
   RETURN to_jsonb(c);
  END IF;

  IF u.credits<500 THEN
   RAISE EXCEPTION 'You need 500 available credits';
  END IF;

  INSERT INTO campaigns(
   user_id,
   request_id,
   title,
   url,
   platform,
   instructions,
   task_type
  )
  VALUES(
   uid,
   (payload->>'request_id')::uuid,
   trim(payload->>'title'),
   trim(payload->>'url'),
   payload->>'platform',
   trim(payload->>'instructions'),
   payload->>'task_type'
  )
  RETURNING * INTO c;

  UPDATE users
  SET
   credits=credits-500,
   reserved_credits=reserved_credits+500,
   submitted_links_count=coalesce(submitted_links_count,0)+1
  WHERE id=uid;

  PERFORM wallet_event(
   uid,
   'reservation',
   -500,
   500,
   'Campaign submitted for review',
   c.id
  );

  RETURN to_jsonb(c);
 END IF;

 IF action IN (
  'approve','reject','distribute','start','settle','report'
 ) THEN
  SELECT *
  INTO c
  FROM campaigns
  WHERE id=(payload->>'campaign_id')::uuid
  FOR UPDATE;

  IF c.id IS NULL THEN
   RAISE EXCEPTION 'Campaign not found';
  END IF;

  cid:=c.id;
 END IF;

 IF action='approve' THEN
  IF c.status<>'pending_approval' THEN
   RAISE EXCEPTION 'Campaign already reviewed';
  END IF;

  UPDATE campaigns
  SET
   status='active',
   approved_at=now(),
   expires_at=now()+interval '7 days'
  WHERE id=cid;

  UPDATE users
  SET
   reserved_credits=reserved_credits-500,
   total_spent_credits=coalesce(total_spent_credits,0)+500,
   earning_allowance=earning_allowance+200,
   earning_unlocked=earning_unlocked+200
  WHERE id=c.user_id;

  PERFORM wallet_event(
   c.user_id,
   'charge',
   0,
   -500,
   '500-credit charge: 300 platform fee + 200 reward pool',
   cid
  );

 ELSIF action='reject' THEN
  IF c.status<>'pending_approval' THEN
   RAISE EXCEPTION 'Campaign already reviewed';
  END IF;

  IF length(trim(coalesce(payload->>'reason','')))<3 THEN
   RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  UPDATE campaigns
  SET
   status='rejected',
   reason=payload->>'reason',
   refunded=500,
   closed_at=now()
  WHERE id=cid;

  UPDATE users
  SET
   credits=credits+500,
   reserved_credits=reserved_credits-500
  WHERE id=c.user_id;

  PERFORM wallet_event(
   c.user_id,
   'release',
   500,
   -500,
   'Rejected campaign: reservation released',
   cid
  );

 ELSIF action='distribute' THEN
  IF c.status<>'active' THEN
   RAISE EXCEPTION 'Only active approved campaigns can be distributed';
  END IF;

  UPDATE campaigns
  SET
   audience=payload->>'audience',
   recipients=ARRAY(
    SELECT jsonb_array_elements_text(
     coalesce(payload->'recipients','[]')
    )::uuid
   ),
   group_ids=ARRAY(
    SELECT jsonb_array_elements_text(
     coalesce(payload->'group_ids','[]')
    )::uuid
   )
  WHERE id=cid;

 ELSIF action='start' THEN
  SELECT *
  INTO q
  FROM campaign_claims
  WHERE campaign_id=cid AND user_id=uid;

  IF q.id IS NOT NULL THEN
   RETURN to_jsonb(q);
  END IF;

  IF c.user_id=uid THEN
   RAISE EXCEPTION 'You cannot earn on your own campaign';
  END IF;

  IF c.status<>'active' OR c.expires_at<=now() THEN
   RAISE EXCEPTION 'Campaign is closed';
  END IF;

  SELECT *
  INTO u
  FROM users
  WHERE id=uid;

  IF c.audience<>'community'
   AND NOT(coalesce(uid=ANY(c.recipients),false))
   AND NOT(coalesce(c.audience='groups' AND u.pod_id IS NOT NULL AND u.pod_id=ANY(c.group_ids),false))
  THEN
   RAISE EXCEPTION 'This campaign is not assigned to you';
  END IF;

  IF u.earning_allowance-u.earning_reserved<2 THEN
   RAISE EXCEPTION
    'Earning allowance exhausted. Submit another campaign to unlock 200 credits.';
  END IF;

  SELECT count(*)
  INTO n
  FROM campaign_claims
  WHERE campaign_id=cid
   AND status IN ('in_progress','pending_verification','verified');

  IF n>=100 THEN
   RAISE EXCEPTION 'All completion slots are reserved';
  END IF;

  INSERT INTO campaign_claims(
   campaign_id,user_id,deadline
  )
  VALUES(
   cid,
   uid,
   least(now()+interval '30 minutes',c.expires_at)
  )
  RETURNING * INTO q;

  UPDATE users
  SET earning_reserved=earning_reserved+2
  WHERE id=uid;

  RETURN to_jsonb(q);

 ELSIF action='evidence' THEN
  SELECT *
  INTO q
  FROM campaign_claims
  WHERE id=(payload->>'claim_id')::uuid
   AND user_id=uid
  FOR UPDATE;

  IF q.id IS NULL
   OR q.status<>'in_progress'
   OR q.deadline<=now()
  THEN
   RAISE EXCEPTION 'Task is not open for submission';
  END IF;

  IF length(trim(coalesce(payload->>'evidence','')))<10 THEN
   RAISE EXCEPTION
    'Describe completion and provide evidence (at least 10 characters)';
  END IF;

  UPDATE campaign_claims
  SET
   status='pending_verification',
   evidence=payload->>'evidence',
   submitted_at=now()
  WHERE id=q.id;

  RETURN '{"ok":true}';

 ELSIF action='review' THEN
  SELECT *
  INTO q
  FROM campaign_claims
  WHERE id=(payload->>'claim_id')::uuid
  FOR UPDATE;

  IF q.id IS NULL OR q.status<>'pending_verification' THEN
   RAISE EXCEPTION 'Claim already reviewed or not submitted';
  END IF;

  SELECT *
  INTO c
  FROM campaigns
  WHERE id=q.campaign_id
  FOR UPDATE;

  cid:=c.id;

  IF c.user_id=uid OR q.user_id=uid THEN
   RAISE EXCEPTION 'Another admin must review this claim';
  END IF;

  approved:=coalesce((payload->>'approved')::boolean,false);

  IF NOT approved
   AND length(trim(coalesce(payload->>'reason','')))<3
  THEN
   RAISE EXCEPTION 'A rejection reason is required';
  END IF;

  UPDATE campaign_claims
  SET
   status=CASE
    WHEN approved THEN 'verified'
    ELSE 'rejected'
   END,
   reason=payload->>'reason',
   reviewed_at=now(),
   reviewer=uid
  WHERE id=q.id;

  UPDATE users
  SET earning_reserved=earning_reserved-2
  WHERE id=q.user_id;

  IF approved THEN
   IF c.distributed+2>200
    OR c.verified_count>=100
    OR c.status NOT IN ('active','settling')
   THEN
    RAISE EXCEPTION 'Campaign reward budget exhausted';
   END IF;

   UPDATE users
   SET
    credits=credits+2,
    earning_allowance=earning_allowance-2,
    total_earned_credits=coalesce(total_earned_credits,0)+2,
    completed_tasks_count=coalesce(completed_tasks_count,0)+1
   WHERE id=q.user_id
    AND earning_allowance>=2;

   IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient earning allowance';
   END IF;

   UPDATE campaigns
   SET
    distributed=distributed+2,
    verified_count=verified_count+1,
    status=CASE
     WHEN verified_count+1=100 THEN 'settling'
     ELSE status
    END
   WHERE id=cid;

   PERFORM wallet_event(
    q.user_id,
    'reward',
    2,
    0,
    'Verified task reward',
    cid,
    q.id
   );
  END IF;

 ELSIF action='settle' THEN
  IF c.status IN ('completed','expired') THEN
   RETURN to_jsonb(c);
  END IF;

  IF c.status<>'settling' THEN
   RAISE EXCEPTION 'Campaign has not reached its target or deadline';
  END IF;

  IF EXISTS(
   SELECT 1
   FROM campaign_claims
   WHERE campaign_id=cid
    AND status IN ('in_progress','pending_verification')
  ) THEN
   RAISE EXCEPTION 'Resolve pending claims before settlement';
  END IF;

  n:=200-c.distributed;

  UPDATE campaigns
  SET
   status=CASE
    WHEN verified_count=100 THEN 'completed'
    ELSE 'expired'
   END,
   refunded=n,
   closed_at=now()
  WHERE id=cid;

  IF n>0 THEN
   UPDATE users
   SET credits=credits+n
   WHERE id=c.user_id;

   PERFORM wallet_event(
    c.user_id,
    'refund',
    n,
    0,
    'Unused campaign reward pool returned',
    cid
   );
  END IF;

 ELSIF action='report' THEN
  IF length(trim(coalesce(payload->>'reason','')))<3 THEN
   RAISE EXCEPTION 'Describe the issue';
  END IF;

  INSERT INTO campaign_reports(campaign_id,user_id,reason)
  VALUES(cid,uid,payload->>'reason')
  ON CONFLICT(campaign_id,user_id)
  DO UPDATE SET reason=excluded.reason;

  RETURN '{"ok":true}';

 ELSIF action='adjust' THEN
  IF u.admin_role<>'owner' OR u.admin_role IS NULL THEN
   RAISE EXCEPTION 'Owner access required';
  END IF;

  n:=(payload->>'amount')::integer;

  IF n=0 OR length(trim(coalesce(payload->>'reason','')))<3 THEN
   RAISE EXCEPTION 'Amount and reason required';
  END IF;

  UPDATE users
  SET credits=credits+n
  WHERE id=(payload->>'user_id')::uuid
   AND credits+n>=0;

  IF NOT FOUND THEN
   RAISE EXCEPTION 'Invalid user or insufficient funds';
  END IF;

  PERFORM wallet_event(
   (payload->>'user_id')::uuid,
   'adjustment',
   n,
   0,
   payload->>'reason'
  );

 ELSIF action='manage_admin' THEN
  IF u.admin_role IS DISTINCT FROM 'owner'
   OR (payload->>'user_id')::uuid=uid
  THEN
   RAISE EXCEPTION 'Owner must manage another account';
  END IF;

  IF EXISTS(
   SELECT 1
   FROM users
   WHERE id=(payload->>'user_id')::uuid
    AND admin_role='owner'
  ) THEN
   RAISE EXCEPTION 'Cannot change owner access';
  END IF;

  approved:=coalesce((payload->>'enabled')::boolean,false);

  IF approved AND length(coalesce(payload->>'pin',''))<6 THEN
   RAISE EXCEPTION 'New admin PIN needs at least 6 characters';
  END IF;

  UPDATE users
  SET
   is_admin=approved,
   admin_role=CASE WHEN approved THEN 'granted' END
  WHERE id=(payload->>'user_id')::uuid;

  IF NOT FOUND THEN
   RAISE EXCEPTION 'Member not found';
  END IF;

  INSERT INTO admin_sessions(user_id,pin_hash)
  VALUES(
   (payload->>'user_id')::uuid,
   CASE
    WHEN approved THEN extensions.crypt(
     payload->>'pin',
     extensions.gen_salt('bf')
    )
   END
  )
  ON CONFLICT(user_id)
  DO UPDATE SET
   pin_hash=excluded.pin_hash,
   expires_at=NULL,
   attempts=0,
   locked_until=NULL;

 ELSIF action='access' THEN
  IF u.admin_role<>'owner'
   OR u.admin_role IS NULL
   OR (payload->>'user_id')::uuid=uid
  THEN
   RAISE EXCEPTION 'Owner must manage another account';
  END IF;

  UPDATE users
  SET is_active=coalesce((payload->>'is_active')::boolean,is_active)
  WHERE id=(payload->>'user_id')::uuid
   AND coalesce(admin_role,'')<>'owner';

 ELSE
  RAISE EXCEPTION 'Unknown action';
 END IF;

 PERFORM campaign_maintenance();

 INSERT INTO admin_events(
  actor,action,campaign_id,claim_id,detail
 )
 VALUES(
  uid,
  action,
  cid,
  q.id,
  CASE
   WHEN action IN ('adjust','access') THEN payload::text
   WHEN action='manage_admin'
    THEN 'Account '||(payload->>'user_id')
     ||' admin access: '||(payload->>'enabled')
   ELSE payload->>'reason'
  END
 );

 RETURN '{"ok":true}';
END
$$;

REVOKE ALL ON FUNCTION public.campaign_action(text,jsonb)
 FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.campaign_action(text,jsonb)
 TO authenticated;

REVOKE ALL ON FUNCTION public.campaign_admin()
 FROM PUBLIC,anon;

GRANT EXECUTE ON FUNCTION public.campaign_admin()
 TO authenticated;

-- Opening entries explain the existing balance without reclassifying historical purchases.
INSERT INTO wallet_events(
 user_id,
 kind,
 amount,
 balance_after,
 reserved_after,
 description,
 reference
)
SELECT
 id,
 'opening_balance',
 credits,
 credits,
 reserved_credits,
 'Balance carried forward from the previous credit system',
 'opening:'||id::text
FROM public.users;

-- Service-only atomic payment settlement. Order amounts are server-validated, not metadata trusted.
CREATE FUNCTION public.settle_credit_order(
 p_reference text,
 p_provider_id text,
 p_amount numeric,
 p_currency text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=public,pg_temp
AS $$
DECLARE o credit_orders;
BEGIN
 PERFORM pg_advisory_xact_lock(5100500200);

 SELECT *
 INTO o
 FROM credit_orders
 WHERE reference=p_reference
 FOR UPDATE;

 IF o.reference IS NULL
  OR p_currency IS DISTINCT FROM 'NGN'
  OR p_amount IS DISTINCT FROM o.amount_naira
  OR p_provider_id IS NULL
 THEN
  RAISE EXCEPTION 'Payment does not match order';
 END IF;

 IF o.status='completed' THEN
  RETURN '{"duplicate":true}';
 END IF;

 UPDATE credit_orders
 SET
  status='completed',
  provider_id=p_provider_id,
  completed_at=now()
 WHERE reference=p_reference;

 UPDATE users
 SET credits=credits+o.credits
 WHERE id=o.user_id;

 PERFORM wallet_event(
  o.user_id,
  'purchase',
  o.credits,
  0,
  'Flutterwave purchase: NGN '||o.amount_naira,
  NULL,
  NULL,
  p_reference
 );

 RETURN '{"ok":true}';
END
$$;

REVOKE ALL ON FUNCTION public.settle_credit_order(
 text,text,numeric,text
) FROM PUBLIC,anon,authenticated;

GRANT EXECUTE ON FUNCTION public.settle_credit_order(
 text,text,numeric,text
) TO service_role;

-- Install automatic expiry/settlement when pg_cron is enabled in Supabase.
DO $schedule$
BEGIN
 IF EXISTS(
  SELECT 1
  FROM pg_extension
  WHERE extname='pg_cron'
 ) THEN
  PERFORM cron.schedule(
   'pcgh-campaign-maintenance',
   '* * * * *',
   'SELECT public.campaign_maintenance()'
  );
 END IF;
END
$schedule$;

COMMIT;
