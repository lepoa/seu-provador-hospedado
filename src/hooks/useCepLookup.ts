import { useState, useCallback } from "react";

interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

interface CepData {
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  cep: string;
}

interface UseCepLookupReturn {
  isLoading: boolean;
  error: string | null;
  data: CepData | null;
  lookup: (cep: string) => Promise<CepData | null>;
  reset: () => void;
}

export function useCepLookup(): UseCepLookupReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CepData | null>(null);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const lookup = useCallback(async (cep: string): Promise<CepData | null> => {
    // Clean CEP - remove non-digits
    const cleanCep = cep.replace(/\D/g, "");
    
    if (cleanCep.length !== 8) {
      setError("CEP deve ter 8 dígitos");
      return null;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      
      if (!response.ok) {
        throw new Error("Erro ao consultar CEP");
      }

      const result: ViaCepResponse = await response.json();

      if (result.erro) {
        setError("CEP não encontrado");
        setData(null);
        return null;
      }

      const cepData: CepData = {
        street: result.logradouro || "",
        neighborhood: result.bairro || "",
        city: result.localidade || "",
        state: result.uf || "",
        cep: result.cep?.replace(/\D/g, "") || cleanCep,
      };

      setData(cepData);
      setError(null);
      return cepData;
    } catch (err) {
      console.error("CEP lookup error:", err);
      setError("Erro ao buscar CEP. Tente novamente.");
      setData(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    data,
    lookup,
    reset,
  };
}

// Format CEP for display: 00000-000
export function formatCep(cep: string): string {
  const clean = cep.replace(/\D/g, "");
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
}

// Mask CEP input
export function maskCep(value: string): string {
  const clean = value.replace(/\D/g, "").slice(0, 8);
  if (clean.length <= 5) return clean;
  return `${clean.slice(0, 5)}-${clean.slice(5, 8)}`;
}
