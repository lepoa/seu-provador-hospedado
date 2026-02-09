// 5.3: Standardized error codes and user-friendly messages

export type ErrorCode = 
  | 'EMAIL_ALREADY_IN_USE'
  | 'INSTAGRAM_ALREADY_IN_USE'
  | 'PHONE_ALREADY_IN_USE'
  | 'INVALID_CEP'
  | 'REQUIRED_FIELD_MISSING'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'MP_UNAVAILABLE'
  | 'MP_INVALID_REQUEST'
  | 'MP_RATE_LIMITED'
  | 'ORDER_NOT_FOUND'
  | 'ORDER_ALREADY_HAS_LINK'
  | 'CART_EMPTY'
  | 'CUSTOMER_MISSING_EMAIL'
  | 'CUSTOMER_MISSING_PHONE'
  | 'ORDER_ZERO_TOTAL'
  | 'NETWORK_ERROR';

export interface ApiError {
  error_code: ErrorCode;
  message: string;
  field?: string;
  action?: string;
  details?: string;
}

// Map error codes to user-friendly messages in Portuguese
export const errorMessages: Record<ErrorCode, { message: string; action?: string }> = {
  EMAIL_ALREADY_IN_USE: {
    message: 'Este e-mail já está cadastrado em outra conta.',
    action: 'Troque o e-mail ou faça login com ele.',
  },
  INSTAGRAM_ALREADY_IN_USE: {
    message: 'Este @ de Instagram já está vinculado a outra conta.',
    action: 'Verifique se já tem cadastro ou entre em contato conosco.',
  },
  PHONE_ALREADY_IN_USE: {
    message: 'Este WhatsApp já está cadastrado.',
    action: 'Use outro número ou faça login com essa conta.',
  },
  INVALID_CEP: {
    message: 'CEP inválido ou não encontrado.',
    action: 'Verifique o CEP e tente novamente.',
  },
  REQUIRED_FIELD_MISSING: {
    message: 'Campo obrigatório não preenchido.',
    action: 'Complete todos os campos obrigatórios.',
  },
  VALIDATION_ERROR: {
    message: 'Erro de validação nos dados.',
    action: 'Verifique as informações e tente novamente.',
  },
  INTERNAL_ERROR: {
    message: 'Erro interno do servidor.',
    action: 'Tente novamente em alguns instantes.',
  },
  MP_UNAVAILABLE: {
    message: 'Mercado Pago indisponível no momento.',
    action: 'Aguarde alguns minutos e tente novamente.',
  },
  MP_INVALID_REQUEST: {
    message: 'Erro ao gerar link de pagamento.',
    action: 'Verifique os dados do pedido.',
  },
  MP_RATE_LIMITED: {
    message: 'Muitas requisições. Aguarde um momento.',
    action: 'Tente novamente em 30 segundos.',
  },
  ORDER_NOT_FOUND: {
    message: 'Pedido não encontrado.',
    action: 'Verifique se o pedido ainda existe.',
  },
  ORDER_ALREADY_HAS_LINK: {
    message: 'Este pedido já possui um link de pagamento.',
    action: 'Copie o link existente abaixo.',
  },
  CART_EMPTY: {
    message: 'O carrinho está vazio.',
    action: 'Adicione itens antes de gerar o link.',
  },
  CUSTOMER_MISSING_EMAIL: {
    message: 'Cliente não possui e-mail cadastrado.',
    action: 'Complete o cadastro do cliente antes de gerar o link.',
  },
  CUSTOMER_MISSING_PHONE: {
    message: 'Cliente não possui WhatsApp cadastrado.',
    action: 'Adicione o WhatsApp do cliente.',
  },
  ORDER_ZERO_TOTAL: {
    message: 'O total do pedido é zero.',
    action: 'Verifique os itens do pedido.',
  },
  NETWORK_ERROR: {
    message: 'Erro de conexão.',
    action: 'Verifique sua internet e tente novamente.',
  },
};

// Get user-friendly error message from API error or code
export function getErrorMessage(error: ApiError | string | unknown): { message: string; action?: string } {
  if (typeof error === 'string') {
    // Try to match known error codes
    const match = Object.keys(errorMessages).find(code => error.includes(code));
    if (match) {
      return errorMessages[match as ErrorCode];
    }
    return { message: error };
  }

  if (error && typeof error === 'object' && 'error_code' in error) {
    const apiError = error as ApiError;
    const known = errorMessages[apiError.error_code];
    if (known) {
      return {
        message: apiError.message || known.message,
        action: apiError.action || known.action,
      };
    }
    return { message: apiError.message };
  }

  if (error instanceof Error) {
    return { message: error.message };
  }

  return errorMessages.INTERNAL_ERROR;
}

// Parse Supabase unique constraint errors
export function parseSupabaseError(error: any): ApiError | null {
  if (!error) return null;
  
  const message = error.message || '';
  const code = error.code || '';

  // Unique constraint violations
  if (code === '23505') {
    if (message.includes('email')) {
      return { error_code: 'EMAIL_ALREADY_IN_USE', message: errorMessages.EMAIL_ALREADY_IN_USE.message };
    }
    if (message.includes('instagram')) {
      return { error_code: 'INSTAGRAM_ALREADY_IN_USE', message: errorMessages.INSTAGRAM_ALREADY_IN_USE.message };
    }
    if (message.includes('phone')) {
      return { error_code: 'PHONE_ALREADY_IN_USE', message: errorMessages.PHONE_ALREADY_IN_USE.message };
    }
    return { error_code: 'VALIDATION_ERROR', message: 'Registro duplicado.', details: message };
  }

  // Not null violations
  if (code === '23502') {
    const fieldMatch = message.match(/column "(\w+)"/);
    return {
      error_code: 'REQUIRED_FIELD_MISSING',
      message: errorMessages.REQUIRED_FIELD_MISSING.message,
      field: fieldMatch?.[1],
    };
  }

  return null;
}
