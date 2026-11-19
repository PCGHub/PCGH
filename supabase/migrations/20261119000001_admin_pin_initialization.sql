-- First-time administrator PIN initialization, callable only by trusted server service role.
-- The API authenticates the current user and verifies their password with Supabase Auth.
CREATE OR REPLACE FUNCTION public.admin_initialize_pin(p_user uuid,p_pin text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
BEGIN
 IF length(p_pin)<8 OR length(p_pin)>128 THEN
  RAISE EXCEPTION 'PIN must be 8 to 128 characters';
 END IF;
 INSERT INTO public.admin_sessions(user_id,pin_hash,attempts,locked_until,expires_at)
 SELECT u.id,extensions.crypt(p_pin,extensions.gen_salt('bf')),0,NULL,NULL
 FROM public.users u
 WHERE u.id=p_user AND u.is_admin AND u.is_active
 ON CONFLICT(user_id) DO UPDATE
 SET pin_hash=excluded.pin_hash,attempts=0,locked_until=NULL,expires_at=NULL
 WHERE public.admin_sessions.pin_hash IS NULL;
 IF NOT FOUND THEN RETURN false; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.admin_initialize_pin(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.admin_initialize_pin(uuid,text) TO service_role;
