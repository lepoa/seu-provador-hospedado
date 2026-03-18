-- =======================================================
-- MANUAL FIX FOR CUSTOMER IDENTITIES (LAÍS TORRES)
-- =======================================================

DO $$
DECLARE
  v_cust_id UUID := '104dc461-195d-498c-84a9-b753b5f80713'; -- Laís Torres CRM ID
  v_handle TEXT := 'laistmelo';
BEGIN
  -- 1. Update CRM record with handle (missing previously)
  UPDATE public.customers 
  SET instagram_handle = v_handle
  WHERE id = v_cust_id;

  -- 2. Create/Update Instagram Identity mapping
  PERFORM public.upsert_instagram_identity(
    v_handle,
    '5562982691262',
    NULL, -- No specific order needed for mapping
    NULL,
    v_cust_id
  );
  
  -- 3. Retroactively link her existing live customer entries for this live
  UPDATE public.live_customers
  SET client_id = v_cust_id,
      nome = 'Laís Torres',
      whatsapp = '5562982691262'
  WHERE instagram_handle ILIKE '%laistmelo%'
    AND client_id IS NULL;
END $$;
