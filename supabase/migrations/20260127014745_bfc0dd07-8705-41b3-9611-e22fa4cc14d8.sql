-- Tabela para tokens de recuperação de senha customizados
CREATE TABLE public.password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone DEFAULT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Índice para busca rápida por token
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);

-- Índice para limpeza de tokens expirados
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- RLS: Ninguém pode acessar diretamente (apenas via service role nas edge functions)
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Função para limpar tokens expirados (pode ser chamada periodicamente)
CREATE OR REPLACE FUNCTION public.cleanup_expired_password_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < now() OR used_at IS NOT NULL;
END;
$$;