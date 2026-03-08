BEGIN;

-- ---------------------------------------------------------------------------
-- RFV tables hardening
-- ---------------------------------------------------------------------------

ALTER TABLE IF EXISTS public.rfv_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rfv_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rfv_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rfv_templates ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- rfv_daily: owner (customer belongs to auth user) or admin
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "rfv_daily owner or admin" ON public.rfv_daily;
CREATE POLICY "rfv_daily owner or admin"
  ON public.rfv_daily
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = rfv_daily.customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = rfv_daily.customer_id
        AND c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- rfv_tasks: owner (customer belongs to auth user) or admin
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "rfv_tasks owner or admin" ON public.rfv_tasks;
CREATE POLICY "rfv_tasks owner or admin"
  ON public.rfv_tasks
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = rfv_tasks.customer_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.id = rfv_tasks.customer_id
        AND c.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- rfv_templates: restricted to merchant/admin roles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "rfv_templates merchant or admin" ON public.rfv_templates;
CREATE POLICY "rfv_templates merchant or admin"
  ON public.rfv_templates
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'merchant'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'merchant'::app_role)
  );

-- ---------------------------------------------------------------------------
-- rfv_execution_log: restricted to merchant/admin roles
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "rfv_execution_log merchant or admin" ON public.rfv_execution_log;
CREATE POLICY "rfv_execution_log merchant or admin"
  ON public.rfv_execution_log
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'merchant'::app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'merchant'::app_role)
  );

COMMIT;
