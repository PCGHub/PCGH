-- Minimal Supabase auth harness for isolated PostgreSQL integration tests.
CREATE SCHEMA auth;
CREATE SCHEMA extensions;

DO $$
BEGIN
 CREATE ROLE anon NOLOGIN;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
 CREATE ROLE authenticated NOLOGIN;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
 CREATE ROLE service_role NOLOGIN BYPASSRLS;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END
$$;

CREATE TABLE auth.users (
 id uuid PRIMARY KEY,
 email text,
 raw_user_meta_data jsonb DEFAULT '{}'
);

CREATE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
 SELECT nullif(
  current_setting('request.jwt.claim.sub',true),
  ''
 )::uuid
$$;

CREATE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
 SELECT '{}'::jsonb
$$;

GRANT USAGE
 ON SCHEMA public,auth
 TO authenticated,anon,service_role;

GRANT EXECUTE
 ON FUNCTION auth.uid()
 TO authenticated,anon;
