-- Adicionar colunas de mídia e estoque ao product_catalog
ALTER TABLE public.product_catalog
ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS video_url text,
ADD COLUMN IF NOT EXISTS main_image_index integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_by_size jsonb DEFAULT '{}',
ADD COLUMN IF NOT EXISTS description text;

-- Comentário para documentação
COMMENT ON COLUMN public.product_catalog.images IS 'Array de URLs de imagens (máximo 5)';
COMMENT ON COLUMN public.product_catalog.video_url IS 'URL do vídeo do produto';
COMMENT ON COLUMN public.product_catalog.main_image_index IS 'Índice da imagem principal no array images';
COMMENT ON COLUMN public.product_catalog.stock_by_size IS 'JSON com estoque por tamanho: PP,P,M,G,GG,34,36,38,40,42,44,46';
COMMENT ON COLUMN public.product_catalog.description IS 'Descrição detalhada do produto';