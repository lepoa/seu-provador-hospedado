
-- Remove duplicate old triggers (keep only the new ones)
DROP TRIGGER IF EXISTS trigger_handle_order_paid ON orders;
DROP TRIGGER IF EXISTS trigger_revert_stock_on_cancel ON orders;
