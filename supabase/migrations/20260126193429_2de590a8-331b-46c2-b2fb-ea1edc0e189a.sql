-- Function to map numeric sizes to letter sizes
CREATE OR REPLACE FUNCTION public.map_numeric_to_letter_sizes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  stock JSONB;
  pp_stock INTEGER;
  p_stock INTEGER;
  m_stock INTEGER;
  g_stock INTEGER;
  gg_stock INTEGER;
BEGIN
  stock := COALESCE(NEW.stock_by_size, '{}'::jsonb);
  
  -- Calculate letter sizes from numeric (use MAX of mapped sizes)
  -- PP = 34, 36
  pp_stock := GREATEST(
    COALESCE((stock->>'34')::INTEGER, 0),
    COALESCE((stock->>'36')::INTEGER, 0)
  );
  
  -- P = 38
  p_stock := COALESCE((stock->>'38')::INTEGER, 0);
  
  -- M = 40
  m_stock := COALESCE((stock->>'40')::INTEGER, 0);
  
  -- G = 42
  g_stock := COALESCE((stock->>'42')::INTEGER, 0);
  
  -- GG = 44, 46
  gg_stock := GREATEST(
    COALESCE((stock->>'44')::INTEGER, 0),
    COALESCE((stock->>'46')::INTEGER, 0)
  );
  
  -- Only update letter sizes if they are 0 and numeric has stock
  -- This preserves manually set letter sizes
  IF COALESCE((stock->>'PP')::INTEGER, 0) = 0 AND pp_stock > 0 THEN
    stock := stock || jsonb_build_object('PP', pp_stock);
  END IF;
  
  IF COALESCE((stock->>'P')::INTEGER, 0) = 0 AND p_stock > 0 THEN
    stock := stock || jsonb_build_object('P', p_stock);
  END IF;
  
  IF COALESCE((stock->>'M')::INTEGER, 0) = 0 AND m_stock > 0 THEN
    stock := stock || jsonb_build_object('M', m_stock);
  END IF;
  
  IF COALESCE((stock->>'G')::INTEGER, 0) = 0 AND g_stock > 0 THEN
    stock := stock || jsonb_build_object('G', g_stock);
  END IF;
  
  IF COALESCE((stock->>'GG')::INTEGER, 0) = 0 AND gg_stock > 0 THEN
    stock := stock || jsonb_build_object('GG', gg_stock);
  END IF;
  
  NEW.stock_by_size := stock;
  RETURN NEW;
END;
$$;

-- Create trigger to auto-map on insert/update
DROP TRIGGER IF EXISTS trigger_map_sizes ON public.product_catalog;
CREATE TRIGGER trigger_map_sizes
  BEFORE INSERT OR UPDATE OF stock_by_size ON public.product_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.map_numeric_to_letter_sizes();

-- Update existing products to map sizes
UPDATE public.product_catalog
SET stock_by_size = stock_by_size || jsonb_build_object(
  'PP', GREATEST(
    COALESCE((stock_by_size->>'PP')::INTEGER, 0),
    GREATEST(
      COALESCE((stock_by_size->>'34')::INTEGER, 0),
      COALESCE((stock_by_size->>'36')::INTEGER, 0)
    )
  ),
  'P', GREATEST(
    COALESCE((stock_by_size->>'P')::INTEGER, 0),
    COALESCE((stock_by_size->>'38')::INTEGER, 0)
  ),
  'M', GREATEST(
    COALESCE((stock_by_size->>'M')::INTEGER, 0),
    COALESCE((stock_by_size->>'40')::INTEGER, 0)
  ),
  'G', GREATEST(
    COALESCE((stock_by_size->>'G')::INTEGER, 0),
    COALESCE((stock_by_size->>'42')::INTEGER, 0)
  ),
  'GG', GREATEST(
    COALESCE((stock_by_size->>'GG')::INTEGER, 0),
    GREATEST(
      COALESCE((stock_by_size->>'44')::INTEGER, 0),
      COALESCE((stock_by_size->>'46')::INTEGER, 0)
    )
  )
)
WHERE stock_by_size IS NOT NULL;