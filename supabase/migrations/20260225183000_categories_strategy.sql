-- Strategic categories metadata for dashboard management.

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NULL,
  name text NOT NULL,
  internal_code text NULL,
  default_margin numeric(5,2) NULL,
  monthly_goal numeric(12,2) NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_default_margin_range
    CHECK (default_margin IS NULL OR (default_margin >= 0 AND default_margin <= 100))
);

CREATE INDEX IF NOT EXISTS idx_categories_user_name
  ON public.categories(user_id, name);

CREATE INDEX IF NOT EXISTS idx_categories_user_active
  ON public.categories(user_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_name_ci
  ON public.categories(user_id, lower(name));

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at
BEFORE UPDATE ON public.categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_select_own_or_global'
  ) THEN
    CREATE POLICY categories_select_own_or_global
      ON public.categories
      FOR SELECT
      USING (auth.uid() = user_id OR user_id IS NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_insert_own'
  ) THEN
    CREATE POLICY categories_insert_own
      ON public.categories
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_update_own'
  ) THEN
    CREATE POLICY categories_update_own
      ON public.categories
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'categories'
      AND policyname = 'categories_delete_own'
  ) THEN
    CREATE POLICY categories_delete_own
      ON public.categories
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END;
$$;

INSERT INTO public.categories (user_id, name, is_active)
SELECT DISTINCT
  p.user_id,
  trim(p.category) AS name,
  true AS is_active
FROM public.product_catalog p
WHERE p.user_id IS NOT NULL
  AND p.category IS NOT NULL
  AND trim(p.category) <> ''
ON CONFLICT DO NOTHING;
