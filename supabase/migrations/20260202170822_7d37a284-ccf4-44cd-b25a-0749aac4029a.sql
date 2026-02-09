-- =========================================================
-- FIX: Remove duplicate restore_stock_on_cancel trigger
-- Problem: restore_stock_on_cancel() ALWAYS increments stock on cancel,
-- even if the order was never paid (stock never decremented)
-- The revert_stock_on_cancel() is the CORRECT function that checks stock_decremented_at
-- =========================================================

-- Drop the incorrect trigger that always restores stock
DROP TRIGGER IF EXISTS trigger_restore_stock_on_cancel ON public.orders;

-- Drop the incorrect function
DROP FUNCTION IF EXISTS public.restore_stock_on_cancel();

-- Ensure the correct trigger exists with proper conditions
DROP TRIGGER IF EXISTS trigger_revert_stock_on_cancel ON public.orders;

CREATE TRIGGER trigger_revert_stock_on_cancel
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  WHEN (
    NEW.status = 'cancelado' 
    AND OLD.status != 'cancelado'
    AND OLD.stock_decremented_at IS NOT NULL
  )
  EXECUTE FUNCTION public.revert_stock_on_cancel();