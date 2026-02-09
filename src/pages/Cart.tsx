import { useNavigate } from "react-router-dom";
import { ShoppingBag, Trash2, Plus, Minus, ArrowLeft, Package, Tag, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { useCart } from "@/contexts/CartContext";
import { useProductAvailableStock } from "@/hooks/useProductAvailableStock";
import { toast } from "sonner";

function formatPrice(price: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
}

const Cart = () => {
  const navigate = useNavigate();
  const { items, removeItem, updateQuantity, total, itemCount } = useCart();
  
  // Get product IDs from cart to fetch available stock
  const productIds = items.map(item => item.productId);
  const { getAvailable, isLoading: stockLoading } = useProductAvailableStock(productIds);
  
  // Handle quantity increment with stock validation
  const handleIncrement = (productId: string, size: string, currentQty: number) => {
    const availableStock = getAvailable(productId, size);
    if (currentQty >= availableStock) {
      toast.error(`Limite do estoque disponível (${availableStock} un.)`);
      return;
    }
    updateQuantity(productId, size, currentQty + 1);
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-12 max-w-lg text-center">
          <ShoppingBag className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h1 className="font-serif text-2xl mb-2">Seu carrinho está vazio</h1>
          <p className="text-muted-foreground mb-6">
            Que tal encontrar algo especial?
          </p>
          <Button onClick={() => navigate("/catalogo")}>
            Ver catálogo
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-lg">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <ShoppingBag className="h-6 w-6 text-accent" />
          <h1 className="font-serif text-2xl">
            Meu Carrinho ({itemCount})
          </h1>
        </div>

        <div className="space-y-4 mb-8">
          {items.map((item) => (
            <Card key={`${item.productId}-${item.size}`}>
              <CardContent className="p-4 flex gap-4">
                <div className="w-20 h-24 bg-stone-50 rounded-lg flex items-center justify-center overflow-hidden">
                  {item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <Package className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                
                <div className="flex-1">
                  <h3 className="font-medium line-clamp-1">{item.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Tamanho: {item.size}
                  </p>
                  {/* Show discount if applicable */}
                  {item.discountPercent > 0 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-semibold text-green-600">
                        {formatPrice(item.price)}
                      </span>
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(item.originalPrice)}
                      </span>
                      <Badge variant="secondary" className="bg-green-100 text-green-700 text-[10px] px-1 py-0">
                        <Tag className="h-2.5 w-2.5 mr-0.5" />
                        -{item.discountPercent}%
                      </Badge>
                    </div>
                  ) : (
                    <p className="font-semibold text-accent mt-1">
                      {formatPrice(item.price)}
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end justify-between">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => removeItem(item.productId, item.size)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <div className="flex flex-col items-end gap-1">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          updateQuantity(item.productId, item.size, item.quantity - 1)
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleIncrement(item.productId, item.size, item.quantity)}
                        disabled={stockLoading || item.quantity >= getAvailable(item.productId, item.size)}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    {/* Show stock limit warning */}
                    {!stockLoading && item.quantity >= getAvailable(item.productId, item.size) && (
                      <span className="text-[10px] text-destructive flex items-center gap-0.5">
                        <AlertCircle className="h-3 w-3" />
                        Máx. disponível
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Summary */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex justify-between items-center text-lg">
              <span className="font-medium">Total</span>
              <span className="font-bold text-accent">{formatPrice(total)}</span>
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={() => navigate("/checkout")}
        >
          Finalizar pedido
        </Button>
      </main>
    </div>
  );
};

export default Cart;
