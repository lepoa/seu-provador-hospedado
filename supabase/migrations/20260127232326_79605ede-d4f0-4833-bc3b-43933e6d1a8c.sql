
-- Corrigir função get_live_reserved_stock para não contar itens de carrinhos pagos
-- Carrinhos pagos já tiveram seu estoque decrementado
CREATE OR REPLACE FUNCTION public.get_live_reserved_stock(p_product_id uuid, p_size text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(lci.qtd), 0)::INTEGER
  FROM public.live_cart_items lci
  JOIN public.live_carts lc ON lc.id = lci.live_cart_id
  JOIN public.live_events le ON le.id = lc.live_event_id
  WHERE lci.product_id = p_product_id
    AND lci.variante->>'tamanho' = p_size
    AND lci.status IN ('reservado', 'confirmado')
    AND le.status IN ('planejada', 'ao_vivo')
    -- Excluir carrinhos pagos (estoque já foi decrementado)
    AND lc.status IN ('aberto', 'em_confirmacao', 'aguardando_pagamento')
$function$;
