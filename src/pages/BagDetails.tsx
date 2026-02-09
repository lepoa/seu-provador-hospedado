import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  XCircle,
  Truck,
  Store,
  Bike,
  CreditCard,
  Loader2,
  AlertTriangle,
  ExternalLink
} from "lucide-react";
import { toast } from "sonner";

interface BagItem {
  id: string;
  productName: string;
  color: string | null;
  size: string | null;
  quantity: number;
  unitPrice: number;
  status: string;
}

interface BagDetails {
  id: string;
  bagNumber: number;
  instagramHandle: string;
  customerName: string | null;
  status: string;
  totalItems: number;
  totalValue: number;
  items: BagItem[];
  deliveryMethod: string | null;
  mpCheckoutUrl: string | null;
  eventTitle: string;
  createdAt: string;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getStatusInfo = (status: string) => {
  switch (status) {
    case 'pago':
      return { 
        label: 'Pago', 
        variant: 'default' as const,
        icon: CheckCircle2,
        tone: 'primary' as const,
      };
    case 'aguardando_pagamento':
      return { 
        label: 'Aguardando Pagamento', 
        variant: 'secondary' as const,
        icon: Clock,
        tone: 'muted' as const,
      };
    case 'cancelado':
    case 'expirado':
      return { 
        label: status === 'cancelado' ? 'Cancelado' : 'Expirado', 
        variant: 'destructive' as const,
        icon: XCircle,
        tone: 'destructive' as const,
      };
    default:
      return { 
        label: 'Em Aberto', 
        variant: 'outline' as const,
        icon: Package,
        tone: 'muted' as const,
      };
  }
};

const getDeliveryInfo = (method: string | null) => {
  switch (method) {
    case 'motoboy':
      return { label: 'Entrega Motoboy', icon: Bike };
    case 'pickup':
      return { label: 'Retirada na Loja', icon: Store };
    case 'shipping':
      return { label: 'Envio Correios', icon: Truck };
    default:
      return { label: 'Não definido', icon: Truck };
  }
};

export default function BagDetails() {
  const { bagId } = useParams();
  const publicToken = new URLSearchParams(window.location.search).get("token");
  const [bag, setBag] = useState<BagDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isGeneratingPayment, setIsGeneratingPayment] = useState(false);

  useEffect(() => {
    if (bagId) {
      fetchBagDetails();
    }
  }, [bagId]);

  const fetchBagDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke('get-live-cart-public', {
        body: { live_cart_id: bagId, public_token: publicToken },
      });

      if (fnError) {
        console.error('Error invoking get-live-cart-public:', fnError);
        setError('Sacola não encontrada');
        return;
      }

      if (!data?.id) {
        setError('Sacola não encontrada');
        return;
      }

      setBag(data as BagDetails);

    } catch (err) {
      console.error('Error fetching bag details:', err);
      setError('Erro ao carregar detalhes da sacola');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGeneratePayment = async () => {
    if (!bag) return;

    setIsGeneratingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-live-cart-payment', {
        body: { live_cart_id: bag.id }
      });

      if (error) throw error;

      const checkoutUrl = data?.init_point as string | undefined;
      if (checkoutUrl) {
        setBag(prev => prev ? { ...prev, mpCheckoutUrl: checkoutUrl } : null);
        toast.success('Link de pagamento gerado!');
      } else {
        toast.error('Não foi possível obter o link de pagamento');
      }
    } catch (err) {
      console.error('Error generating payment:', err);
      toast.error('Erro ao gerar link de pagamento');
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  if (error || !bag) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Sacola não encontrada</h2>
            <p className="text-muted-foreground">
              {error || 'O QR code pode ser inválido ou a sacola foi removida.'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const statusInfo = getStatusInfo(bag.status);
  const deliveryInfo = getDeliveryInfo(bag.deliveryMethod);
  const StatusIcon = statusInfo.icon;
  const DeliveryIcon = deliveryInfo.icon;

  const statusTextClass =
    statusInfo.tone === 'destructive'
      ? 'text-destructive'
      : statusInfo.tone === 'primary'
      ? 'text-primary'
      : 'text-muted-foreground';

  const isPaid = bag.status === 'pago';
  const showPaymentOption = !isPaid && bag.status !== 'cancelado' && bag.status !== 'expirado';

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Header Card */}
        <Card>
          <CardHeader className="text-center pb-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {bag.eventTitle}
            </p>
            <CardTitle className="text-4xl font-bold">
              #{bag.bagNumber.toString().padStart(3, '0')}
            </CardTitle>
            <p className="text-lg font-semibold text-primary">
              {bag.instagramHandle}
            </p>
            {bag.customerName && (
              <p className="text-sm text-muted-foreground">{bag.customerName}</p>
            )}
          </CardHeader>
        </Card>

        {/* Status Card */}
        <Card className="border-2 border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <StatusIcon className={`h-8 w-8 ${statusTextClass}`} />
                <div>
                  <p className="text-sm text-muted-foreground">Status do Pagamento</p>
                  <p className={`text-lg font-bold ${statusTextClass}`}>
                    {statusInfo.label}
                  </p>
                </div>
              </div>
              <Badge variant={statusInfo.variant} className="text-base px-4 py-1">
                {isPaid ? 'OK' : 'Pendente'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Method Card */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <DeliveryIcon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Método de Entrega</p>
                <p className="text-lg font-semibold">{deliveryInfo.label}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4" />
              Itens da Sacola ({bag.totalItems})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {bag.items.map((item) => (
              <div key={item.id} className="flex justify-between items-start py-2 border-b last:border-0">
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">
                    {[item.color, item.size].filter(Boolean).join(' • ')}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">
                    {item.quantity}x {formatCurrency(item.unitPrice)}
                  </p>
                </div>
              </div>
            ))}
            
            <Separator />
            
            <div className="flex justify-between items-center pt-2">
              <span className="text-lg font-bold">Total</span>
              <span className="text-xl font-bold text-primary">
                {formatCurrency(bag.totalValue)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Action Card */}
        {showPaymentOption && (
          <Card className="border-primary">
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <CreditCard className="h-6 w-6" />
                <div>
                  <p className="font-semibold">Pagamento Pendente</p>
                  <p className="text-sm text-muted-foreground">
                    Clique abaixo para gerar ou acessar o link de pagamento
                  </p>
                </div>
              </div>

              {bag.mpCheckoutUrl ? (
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={() => window.open(bag.mpCheckoutUrl!, '_blank')}
                >
                  <ExternalLink className="h-4 w-4" />
                  Ir para Pagamento
                </Button>
              ) : (
                <Button 
                  className="w-full gap-2" 
                  size="lg"
                  onClick={handleGeneratePayment}
                  disabled={isGeneratingPayment}
                >
                  {isGeneratingPayment ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CreditCard className="h-4 w-4" />
                  )}
                  {isGeneratingPayment ? 'Gerando...' : 'Gerar Link de Pagamento'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Success Message for Paid */}
        {isPaid && (
          <Card className="bg-secondary border-border">
            <CardContent className="pt-4">
              <div className="flex items-center gap-3 text-primary">
                <CheckCircle2 className="h-8 w-8" />
                <div>
                  <p className="font-bold text-lg">Pagamento Confirmado!</p>
                  <p className="text-sm">
                    Esta sacola está pronta para separação/entrega.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Sacola criada em {new Date(bag.createdAt).toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
}
