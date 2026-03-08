BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS privacy_accepted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS privacy_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS terms_version text,
  ADD COLUMN IF NOT EXISTS privacy_version text,
  ADD COLUMN IF NOT EXISTS consent_ip text,
  ADD COLUMN IF NOT EXISTS consent_user_agent text;

CREATE OR REPLACE FUNCTION public.set_profiles_terms_accepted_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Auto-preenche timestamp quando terms_accepted muda para true.
  IF NEW.terms_accepted IS TRUE
     AND COALESCE(OLD.terms_accepted, FALSE) IS DISTINCT FROM TRUE
     AND NEW.terms_accepted_at IS NULL THEN
    NEW.terms_accepted_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_profiles_terms_accepted_at ON public.profiles;

CREATE TRIGGER set_profiles_terms_accepted_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_profiles_terms_accepted_at();

COMMIT;
