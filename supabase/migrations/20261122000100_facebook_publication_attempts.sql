-- Only the publishing Edge Function may claim or update a publication.
CREATE TABLE public.facebook_publication_attempts (
  request_id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'unknown')),
  post_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.facebook_publication_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.facebook_publication_attempts FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.facebook_publication_attempts TO service_role;
