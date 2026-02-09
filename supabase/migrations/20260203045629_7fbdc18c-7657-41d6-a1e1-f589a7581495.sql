-- Fix trigger to use correct enum values for live_cart_status
-- The 'cobrado' status doesn't exist in the enum

CREATE OR REPLACE FUNCTION public.trigger_sync_live_cart_to_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only sync for meaningful status changes that should create/update an order
  -- Skip very early states before any commitment
  -- Note: Using status values that exist in the live_cart_status enum
  IF NEW.status IN ('aguardando_pagamento', 'pago', 'cancelado', 'expirado') 
     OR (NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago')
     OR (NEW.operational_status IS DISTINCT FROM OLD.operational_status AND NEW.status = 'pago') THEN
    PERFORM sync_live_cart_to_orders(NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;