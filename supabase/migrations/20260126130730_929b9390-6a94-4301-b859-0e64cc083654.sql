-- Remove the unique constraint on group_key since we now group products by SKU (REFERE + COR)
-- Multiple products can share the same group_key (model) with different colors
DROP INDEX IF EXISTS idx_product_catalog_group_key_unique;