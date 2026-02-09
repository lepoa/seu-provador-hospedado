import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Users, 
  Copy, 
  Check,
  MessageCircle,
  Sparkles,
  Ruler,
  Tag,
  Palette,
  Calendar,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { buildWhatsAppLink } from "@/lib/whatsappHelpers";
import { suggestCustomersForProduct } from "@/lib/customerSuggestions";

interface Suggestion {
  id: string;
  customer_id: string;
  score: number;
  reasons: Array<{
    type: string;
    label: string;
    points: number;
  }>;
  notified: boolean;
  customer: {
    id: string;
    name: string | null;
    phone: string;
    size: string | null;
    style_title: string | null;
  };
}

interface CustomerSuggestionsProps {
  productId: string;
  productName: string;
}

export function CustomerSuggestions({ productId, productName }: CustomerSuggestionsProps) {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadSuggestions();
  }, [productId]);

  const loadSuggestions = async () => {
    try {
      // Load suggestions with customer data
      const { data: suggestionsData, error } = await supabase
        .from("customer_product_suggestions")
        .select("*")
        .eq("product_id", productId)
        .order("score", { ascending: false });

      if (error) throw error;

      if (!suggestionsData || suggestionsData.length === 0) {
        setSuggestions([]);
        return;
      }

      // Load customer data for suggestions
      const customerIds = suggestionsData.map(s => s.customer_id);
      const { data: customersData } = await supabase
        .from("customers")
        .select("id, name, phone, size, style_title")
        .in("id", customerIds);

      const customersMap: Record<string, any> = {};
      (customersData || []).forEach(c => {
        customersMap[c.id] = c;
      });

      const enrichedSuggestions: Suggestion[] = suggestionsData
        .filter(s => customersMap[s.customer_id])
        .map(s => ({
          ...s,
          reasons: s.reasons as Suggestion["reasons"],
          customer: customersMap[s.customer_id],
        }));

      setSuggestions(enrichedSuggestions);
    } catch (error) {
      console.error("Error loading suggestions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const result = await suggestCustomersForProduct(productId);
      if (result.success) {
        toast.success(`${result.count} cliente(s) sugerido(s)`);
        loadSuggestions();
      } else {
        toast.error(result.error || "Erro ao atualizar sugestões");
      }
    } catch (error) {
      toast.error("Erro ao atualizar sugestões");
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatPhone = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const buildMessage = (suggestion: Suggestion) => {
    const name = suggestion.customer.name || "";
    const size = suggestion.customer.size;
    const sizeText = size ? ` Tenho no seu tamanho ${size}` : "";
    
    return `Oi${name ? ` ${name}` : ""}! Chegou uma peça que tem tudo a ver com você… ${productName}${sizeText} 💛`;
  };

  const handleCopyMessage = (suggestion: Suggestion) => {
    const message = buildMessage(suggestion);
    navigator.clipboard.writeText(message);
    setCopiedId(suggestion.id);
    toast.success("Mensagem copiada!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleMarkNotified = async (suggestionId: string) => {
    await supabase
      .from("customer_product_suggestions")
      .update({ notified: true })
      .eq("id", suggestionId);
    
    setSuggestions(prev => 
      prev.map(s => s.id === suggestionId ? { ...s, notified: true } : s)
    );
  };

  const getReasonIcon = (type: string) => {
    switch (type) {
      case "style": return <Sparkles className="h-3 w-3" />;
      case "size": return <Ruler className="h-3 w-3" />;
      case "category": return <Tag className="h-3 w-3" />;
      case "color": return <Palette className="h-3 w-3" />;
      case "occasion": return <Calendar className="h-3 w-3" />;
      default: return null;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            Clientes para avisar
            {suggestions.length > 0 && (
              <Badge variant="secondary">{suggestions.length}</Badge>
            )}
          </CardTitle>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="gap-1"
          >
            {isRefreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p className="mb-2">Nenhum cliente sugerido ainda.</p>
            <p className="text-sm">
              Clientes com quiz completado serão sugeridos com base no match de estilo.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {suggestions.map((suggestion) => (
              <div 
                key={suggestion.id}
                className={`border rounded-lg p-4 ${
                  suggestion.notified 
                    ? "bg-muted/30 border-border" 
                    : "bg-card border-primary/20"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <button
                        onClick={() => navigate(`/dashboard/clientes/${suggestion.customer.id}`)}
                        className="font-medium hover:text-primary transition-colors truncate"
                      >
                        {suggestion.customer.name || "Cliente sem nome"}
                      </button>
                      <Badge 
                        variant={suggestion.score >= 10 ? "default" : "secondary"}
                        className="shrink-0"
                      >
                        Score: {suggestion.score}
                      </Badge>
                      {suggestion.notified && (
                        <Badge variant="outline" className="shrink-0 text-green-600">
                          <Check className="h-3 w-3 mr-1" />
                          Avisado
                        </Badge>
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2">
                      {formatPhone(suggestion.customer.phone)}
                      {suggestion.customer.size && ` • Tam. ${suggestion.customer.size}`}
                      {suggestion.customer.style_title && ` • ${suggestion.customer.style_title}`}
                    </p>

                    {/* Reasons */}
                    <div className="flex flex-wrap gap-1.5">
                      {suggestion.reasons.map((reason, idx) => (
                        <Badge 
                          key={idx} 
                          variant="outline" 
                          className="text-xs gap-1 bg-background"
                        >
                          {getReasonIcon(reason.type)}
                          {reason.label}
                          <span className="text-primary">+{reason.points}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyMessage(suggestion)}
                      className="gap-1"
                    >
                      {copiedId === suggestion.id ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <a
                      href={buildWhatsAppLink(buildMessage(suggestion))}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => handleMarkNotified(suggestion.id)}
                      className="inline-flex items-center justify-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-[#25D366] text-white hover:bg-[#1EBE5D] transition-colors"
                    >
                      <MessageCircle className="h-4 w-4" />
                      <span className="hidden sm:inline">WhatsApp</span>
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
