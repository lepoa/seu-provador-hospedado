-- Function to get effective prices for products applying promotional tables
-- Returns: product_id, original_price, effective_price, promotion_id, discount_type, discount_value, discount_source

CREATE OR REPLACE FUNCTION public.get_products_effective_prices(
  p_channel TEXT DEFAULT 'catalog',
  p_product_ids UUID[] DEFAULT NULL
)
RETURNS TABLE (
  product_id UUID,
  original_price NUMERIC,
  effective_price NUMERIC,
  promotion_id UUID,
  promotion_name TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_source TEXT,
  debug_info JSONB
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
BEGIN
  RETURN QUERY
  WITH active_promotions AS (
    -- Get all active promotions for the given channel
    SELECT 
      pt.id,
      pt.name,
      pt.priority,
      pt.store_discount_type,
      pt.store_discount_value,
      pt.store_min_order_value,
      pt.category_discounts,
      pt.product_discounts,
      pt.channel_scope
    FROM promotional_tables pt
    WHERE pt.is_active = true
      AND (pt.channel_scope = 'all' OR pt.channel_scope = p_channel)
      AND (pt.start_at IS NULL OR pt.start_at <= v_now)
      AND (pt.end_at IS NULL OR pt.end_at >= v_now)
    ORDER BY pt.priority DESC
  ),
  products_base AS (
    SELECT 
      pc.id,
      pc.price,
      pc.category,
      pc.discount_type AS product_discount_type,
      pc.discount_value AS product_discount_value
    FROM product_catalog pc
    WHERE pc.is_active = true
      AND (p_product_ids IS NULL OR pc.id = ANY(p_product_ids))
  ),
  product_level_discounts AS (
    -- Check for product-specific discounts in promotional tables
    SELECT DISTINCT ON (pb.id)
      pb.id AS product_id,
      ap.id AS promo_id,
      ap.name AS promo_name,
      (elem->>'discount_type')::TEXT AS disc_type,
      (elem->>'discount_value')::NUMERIC AS disc_value,
      'promotional_table_product'::TEXT AS source,
      ap.priority
    FROM products_base pb
    CROSS JOIN active_promotions ap
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ap.product_discounts, '[]'::jsonb)) AS elem
    WHERE (elem->>'product_id')::UUID = pb.id
      AND (elem->>'discount_value')::NUMERIC > 0
    ORDER BY pb.id, ap.priority DESC
  ),
  category_level_discounts AS (
    -- Check for category-level discounts in promotional tables (only if no product-specific)
    SELECT DISTINCT ON (pb.id)
      pb.id AS product_id,
      ap.id AS promo_id,
      ap.name AS promo_name,
      (elem->>'discount_type')::TEXT AS disc_type,
      (elem->>'discount_value')::NUMERIC AS disc_value,
      'promotional_table_category'::TEXT AS source,
      ap.priority
    FROM products_base pb
    CROSS JOIN active_promotions ap
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ap.category_discounts, '[]'::jsonb)) AS elem
    WHERE pb.category IS NOT NULL
      AND LOWER(elem->>'category') = LOWER(pb.category)
      AND (elem->>'discount_value')::NUMERIC > 0
      AND NOT EXISTS (SELECT 1 FROM product_level_discounts pld WHERE pld.product_id = pb.id)
    ORDER BY pb.id, ap.priority DESC
  ),
  store_level_discounts AS (
    -- Check for store-wide discounts (only if no product or category specific)
    SELECT DISTINCT ON (pb.id)
      pb.id AS product_id,
      ap.id AS promo_id,
      ap.name AS promo_name,
      ap.store_discount_type::TEXT AS disc_type,
      ap.store_discount_value AS disc_value,
      'promotional_table_store'::TEXT AS source,
      ap.priority
    FROM products_base pb
    CROSS JOIN active_promotions ap
    WHERE ap.store_discount_type IS NOT NULL
      AND ap.store_discount_value IS NOT NULL
      AND ap.store_discount_value > 0
      AND NOT EXISTS (SELECT 1 FROM product_level_discounts pld WHERE pld.product_id = pb.id)
      AND NOT EXISTS (SELECT 1 FROM category_level_discounts cld WHERE cld.product_id = pb.id)
    ORDER BY pb.id, ap.priority DESC
  ),
  all_discounts AS (
    SELECT * FROM product_level_discounts
    UNION ALL
    SELECT * FROM category_level_discounts
    UNION ALL
    SELECT * FROM store_level_discounts
  ),
  final_prices AS (
    SELECT 
      pb.id AS product_id,
      pb.price AS original_price,
      CASE 
        -- First check promotional table discounts
        WHEN ad.disc_type = 'percentage' AND ad.disc_value IS NOT NULL THEN
          ROUND(pb.price * (1 - ad.disc_value / 100), 2)
        WHEN ad.disc_type = 'fixed' AND ad.disc_value IS NOT NULL THEN
          GREATEST(0, ROUND(pb.price - ad.disc_value, 2))
        -- Then fall back to product-level discounts
        WHEN pb.product_discount_type = 'percentage' AND pb.product_discount_value IS NOT NULL AND pb.product_discount_value > 0 THEN
          ROUND(pb.price * (1 - pb.product_discount_value / 100), 2)
        WHEN pb.product_discount_type = 'fixed' AND pb.product_discount_value IS NOT NULL AND pb.product_discount_value > 0 THEN
          GREATEST(0, ROUND(pb.price - pb.product_discount_value, 2))
        ELSE
          pb.price
      END AS effective_price,
      COALESCE(ad.promo_id, NULL) AS promotion_id,
      COALESCE(ad.promo_name, NULL) AS promotion_name,
      COALESCE(ad.disc_type, pb.product_discount_type::TEXT) AS discount_type,
      COALESCE(ad.disc_value, pb.product_discount_value) AS discount_value,
      COALESCE(ad.source, 
        CASE WHEN pb.product_discount_value > 0 THEN 'product_catalog' ELSE NULL END
      ) AS discount_source,
      jsonb_build_object(
        'checked_at', v_now,
        'channel', p_channel,
        'product_discount', jsonb_build_object(
          'type', pb.product_discount_type,
          'value', pb.product_discount_value
        ),
        'promotional_discount', CASE WHEN ad.promo_id IS NOT NULL THEN
          jsonb_build_object(
            'promotion_id', ad.promo_id,
            'promotion_name', ad.promo_name,
            'type', ad.disc_type,
            'value', ad.disc_value,
            'source', ad.source,
            'priority', ad.priority
          )
        ELSE NULL END,
        'active_promotions_count', (SELECT COUNT(*) FROM active_promotions)
      ) AS debug_info
    FROM products_base pb
    LEFT JOIN all_discounts ad ON ad.product_id = pb.id
  )
  SELECT 
    fp.product_id,
    fp.original_price,
    fp.effective_price,
    fp.promotion_id,
    fp.promotion_name,
    fp.discount_type,
    fp.discount_value,
    fp.discount_source,
    fp.debug_info
  FROM final_prices fp;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.get_products_effective_prices(TEXT, UUID[]) TO anon, authenticated;