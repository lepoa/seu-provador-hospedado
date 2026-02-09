import { AlertTriangle, ListOrdered, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LiveWaitlist, LiveProduct } from "@/types/liveShop";

interface WaitlistAlertProps {
  entries: LiveWaitlist[];
  products: LiveProduct[];
  getAvailableStock: (productId: string, size: string, totalStock: number) => number;
  onOfferClick: (entry: LiveWaitlist, product: LiveProduct) => void;
}

interface AlertItem {
  entry: LiveWaitlist;
  product: LiveProduct;
  availableStock: number;
}

export function WaitlistAlert({
  entries,
  products,
  getAvailableStock,
  onOfferClick,
}: WaitlistAlertProps) {
  // Find waitlist entries where stock is now available
  const alertItems: AlertItem[] = [];

  entries.forEach(entry => {
    if (entry.status !== 'ativa') return;
    
    const product = products.find(p => p.product_id === entry.product_id);
    if (!product?.product) return;
    
    const size = (entry.variante as any)?.tamanho || '';
    const availableBySize = (product.product as any).available_by_size || {};
    const available = getAvailableStock(product.product_id, size, availableBySize[size] || 0);

    if (available > 0) {
      alertItems.push({ entry, product, availableStock: available });
    }
  });

  if (alertItems.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
        <span className="font-semibold text-amber-800">
          Estoque Liberado - {alertItems.length} na Fila
        </span>
      </div>
      
      <div className="space-y-2">
        {alertItems.slice(0, 3).map(({ entry, product, availableStock }) => (
          <div 
            key={entry.id}
            className="flex items-center justify-between gap-2 p-2 bg-white/50 rounded"
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="w-8 h-8 bg-secondary rounded overflow-hidden shrink-0">
                {product.product?.image_url && (
                  <img 
                    src={product.product.image_url} 
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {entry.instagram_handle}
                </div>
                <div className="text-xs text-amber-700">
                  {product.product?.name} - Tam: {(entry.variante as any)?.tamanho}
                </div>
              </div>
            </div>
            <Button
              size="sm"
              className="shrink-0 gap-1 bg-amber-600 hover:bg-amber-700"
              onClick={() => onOfferClick(entry, product)}
            >
              <ArrowRight className="h-3 w-3" />
              Oferecer
            </Button>
          </div>
        ))}
        
        {alertItems.length > 3 && (
          <div className="text-xs text-amber-600 text-center">
            +{alertItems.length - 3} mais na fila
          </div>
        )}
      </div>
    </div>
  );
}
