import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  Package,
  CheckCircle,
  Clock,
  X,
  Users,
  ShoppingCart,
  ListOrdered,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { sortSizes } from "@/lib/sizeUtils";
import type { LiveProduct, LiveCart, LiveWaitlist } from "@/types/liveShop";

interface WhoGotItModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: LiveProduct[];
  carts: LiveCart[];
  waitlist: LiveWaitlist[];
  reservedStock: Record<string, Record<string, number>>;
}

export function WhoGotItModal({
  open,
  onOpenChange,
  products,
  carts,
  waitlist,
  reservedStock,
}: WhoGotItModalProps) {
  const [activeTab, setActiveTab] = useState<"instagram" | "produto">("instagram");
  const [searchInstagram, setSearchInstagram] = useState("");
  const [searchProduct, setSearchProduct] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<LiveProduct | null>(null);
  const [selectedVariation, setSelectedVariation] = useState<{ size: string } | null>(null);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  // Search customer by Instagram
  const customerResult = useMemo(() => {
    if (!searchInstagram.trim()) return null;

    const handle = searchInstagram.startsWith("@")
      ? searchInstagram.toLowerCase()
      : `@${searchInstagram.toLowerCase()}`;

    // Find cart for this customer
    const customerCart = carts.find(
      (c) => c.live_customer?.instagram_handle.toLowerCase() === handle
    );

    // Find waitlist entries
    const customerWaitlist = waitlist.filter(
      (w) => w.instagram_handle.toLowerCase() === handle
    );

    if (!customerCart && customerWaitlist.length === 0) {
      return { found: false, handle };
    }

    const items = (customerCart?.items || []).filter((i) =>
      ["reservado", "confirmado"].includes(i.status)
    );

    const totalReservado = items.reduce(
      (sum, i) => sum + i.preco_unitario * i.qtd,
      0
    );
    const confirmedCount = items.filter((i) => i.status === "confirmado").length;
    const reservedCount = items.filter((i) => i.status === "reservado").length;

    return {
      found: true,
      handle,
      cart: customerCart,
      items,
      waitlistEntries: customerWaitlist,
      totalReservado,
      confirmedCount,
      reservedCount,
      status: customerCart?.status,
    };
  }, [searchInstagram, carts, waitlist]);

  // Filter products for search
  const filteredProducts = useMemo(() => {
    if (!searchProduct.trim()) return products;
    const search = searchProduct.toLowerCase();
    return products.filter(
      (p) =>
        p.product?.name.toLowerCase().includes(search) ||
        p.product?.sku?.toLowerCase().includes(search) ||
        p.product?.group_key?.toLowerCase().includes(search)
    );
  }, [searchProduct, products]);

  // Get reservations for selected product/variation
  const variationDetails = useMemo(() => {
    if (!selectedProduct || !selectedVariation) return null;

    const productId = selectedProduct.product_id;
    const size = selectedVariation.size;

    // Get all reservations
    const reservations: Array<{
      instagram: string;
      time: string;
      status: string;
      qty: number;
    }> = [];

    carts.forEach((cart) => {
      (cart.items || [])
        .filter(
          (item) =>
            item.product_id === productId &&
            (item.variante as any)?.tamanho === size &&
            ["reservado", "confirmado"].includes(item.status)
        )
        .forEach((item) => {
          reservations.push({
            instagram: cart.live_customer?.instagram_handle || "Desconhecido",
            time: format(new Date(item.reservado_em), "HH:mm", { locale: ptBR }),
            status: item.status,
            qty: item.qtd,
          });
        });
    });

    // Get waitlist
    const waitlistEntries = waitlist
      .filter(
        (w) =>
          w.product_id === productId &&
          (w.variante as any)?.tamanho === size &&
          w.status === "ativa"
      )
      .sort((a, b) => a.ordem - b.ordem);

    const totalStock =
      (selectedProduct.product?.stock_by_size as Record<string, number>)?.[size] || 0;
    const reserved = reservedStock[productId]?.[size] || 0;

    return {
      totalStock,
      reserved,
      available: Math.max(0, totalStock - reserved),
      reservations,
      waitlistEntries,
    };
  }, [selectedProduct, selectedVariation, carts, waitlist, reservedStock]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Quem garantiu?
          </DialogTitle>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as any)}
          className="flex-1 flex flex-col overflow-hidden"
        >
          <TabsList className="grid grid-cols-2 shrink-0">
            <TabsTrigger value="instagram" className="gap-1">
              <Users className="h-4 w-4" />
              Por @
            </TabsTrigger>
            <TabsTrigger value="produto" className="gap-1">
              <Package className="h-4 w-4" />
              Por Produto
            </TabsTrigger>
          </TabsList>

          {/* Tab: Por @ */}
          <TabsContent value="instagram" className="flex-1 overflow-auto mt-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="@instagram"
                value={searchInstagram}
                onChange={(e) => setSearchInstagram(e.target.value)}
                className="pl-10"
              />
            </div>

            {customerResult && !customerResult.found && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <X className="h-5 w-5 text-red-600" />
                  <span className="font-medium text-red-700">
                    {customerResult.handle} não consta
                  </span>
                </div>
              </div>
            )}

            {customerResult?.found && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-lg">{customerResult.handle}</span>
                    <Badge
                      variant={
                        customerResult.status === "pago"
                          ? "default"
                          : customerResult.status === "aguardando_pagamento"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {customerResult.status === "pago"
                        ? "Pago"
                        : customerResult.status === "aguardando_pagamento"
                        ? "Aguardando Pagamento"
                        : "Pendente"}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">Reservados:</span>
                      <span className="ml-1 font-medium">{customerResult.reservedCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Confirmados:</span>
                      <span className="ml-1 font-medium">{customerResult.confirmedCount}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total:</span>
                      <span className="ml-1 font-medium">
                        {formatPrice(customerResult.totalReservado)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Items */}
                {customerResult.items.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Itens Reservados</h4>
                    {customerResult.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-2 bg-green-50 border border-green-100 rounded-lg"
                      >
                        <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
                          {item.product?.image_url && (
                            <img
                              src={item.product.image_url}
                              alt={item.product.name}
                              className="w-full h-full object-cover"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm truncate">
                            {item.product?.name}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.product?.color && `${item.product.color} • `}
                            Tam: {(item.variante as any)?.tamanho} • Qtd: {item.qtd}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-medium text-sm">
                            {formatPrice(item.preco_unitario * item.qtd)}
                          </div>
                          <Badge
                            variant={item.status === "confirmado" ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {item.status === "confirmado" ? (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Confirmado
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3 mr-1" />
                                Reservado
                              </>
                            )}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Waitlist */}
                {customerResult.waitlistEntries.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Na Lista de Espera</h4>
                    {customerResult.waitlistEntries.map((w) => {
                      const product = products.find((p) => p.product_id === w.product_id);
                      return (
                        <div
                          key={w.id}
                          className="flex items-center gap-3 p-2 bg-amber-50 border border-amber-100 rounded-lg"
                        >
                          <ListOrdered className="h-5 w-5 text-amber-600" />
                          <div className="flex-1">
                            <div className="font-medium text-sm">
                              {product?.product?.name || "Produto"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Tam: {(w.variante as any)?.tamanho} • Posição #{w.ordem}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* Tab: Por Produto */}
          <TabsContent value="produto" className="flex-1 overflow-hidden mt-4">
            {!selectedProduct ? (
              <div className="h-full flex flex-col">
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar produto por nome ou código..."
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    className="pl-10"
                  />
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {filteredProducts.map((lp) => {
                      const product = lp.product;
                      if (!product) return null;

                      return (
                        <div
                          key={lp.id}
                          className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => setSelectedProduct(lp)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-secondary rounded overflow-hidden shrink-0">
                              {product.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm truncate">
                                {product.name}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {product.sku || product.group_key}
                                {product.color && ` • ${product.color}`}
                              </div>
                            </div>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            ) : !selectedVariation ? (
              <div className="h-full flex flex-col">
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start mb-4"
                  onClick={() => setSelectedProduct(null)}
                >
                  ← Voltar
                </Button>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
                  <div className="w-16 h-16 bg-secondary rounded overflow-hidden shrink-0">
                    {selectedProduct.product?.image_url && (
                      <img
                        src={selectedProduct.product.image_url}
                        alt={selectedProduct.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-medium">{selectedProduct.product?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedProduct.product?.color}
                    </div>
                  </div>
                </div>

                <h4 className="font-medium mb-3">Selecione um tamanho:</h4>

                <div className="grid grid-cols-4 gap-2">
                  {sortSizes(
                    Object.keys(selectedProduct.product?.stock_by_size || {})
                  ).map((size) => {
                    const totalStock =
                      (selectedProduct.product?.stock_by_size as Record<string, number>)?.[
                        size
                      ] || 0;
                    const reserved =
                      reservedStock[selectedProduct.product_id]?.[size] || 0;
                    const available = Math.max(0, totalStock - reserved);
                    const waitlistCount = waitlist.filter(
                      (w) =>
                        w.product_id === selectedProduct.product_id &&
                        (w.variante as any)?.tamanho === size &&
                        w.status === "ativa"
                    ).length;

                    return (
                      <button
                        key={size}
                        className={`p-3 rounded-lg border text-center transition-colors hover:border-primary ${
                          available === 0 ? "bg-muted" : ""
                        }`}
                        onClick={() => setSelectedVariation({ size })}
                      >
                        <div className="font-bold text-lg">{size}</div>
                        <div className="text-xs text-muted-foreground space-y-0.5">
                          <div>Total: {totalStock}</div>
                          <div className="text-amber-600">Reserv: {reserved}</div>
                          <div className={available > 0 ? "text-green-600" : "text-red-600"}>
                            Disp: {available}
                          </div>
                          {waitlistCount > 0 && (
                            <div className="text-blue-600">Fila: {waitlistCount}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start mb-4"
                  onClick={() => setSelectedVariation(null)}
                >
                  ← Voltar
                </Button>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
                  <div className="w-12 h-12 bg-secondary rounded overflow-hidden shrink-0">
                    {selectedProduct.product?.image_url && (
                      <img
                        src={selectedProduct.product.image_url}
                        alt={selectedProduct.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{selectedProduct.product?.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedProduct.product?.color} • Tam: {selectedVariation.size}
                    </div>
                  </div>
                  {variationDetails && (
                    <div className="text-right text-sm">
                      <div>
                        Disponível:{" "}
                        <span
                          className={
                            variationDetails.available > 0
                              ? "text-green-600 font-medium"
                              : "text-red-600 font-medium"
                          }
                        >
                          {variationDetails.available}
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        de {variationDetails.totalStock} total
                      </div>
                    </div>
                  )}
                </div>

                <ScrollArea className="flex-1">
                  {variationDetails && (
                    <div className="space-y-4">
                      {/* Reservations */}
                      {variationDetails.reservations.length > 0 ? (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Reservas ({variationDetails.reservations.length})
                          </h4>
                          {variationDetails.reservations.map((r, i) => (
                            <div
                              key={i}
                              className="flex items-center justify-between p-2 bg-green-50 border border-green-100 rounded-lg"
                            >
                              <div>
                                <span className="font-medium">{r.instagram}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  {r.time}
                                </span>
                              </div>
                              <Badge
                                variant={r.status === "confirmado" ? "default" : "secondary"}
                              >
                                {r.status === "confirmado" ? "Confirmado" : "Reservado"}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-center text-muted-foreground">
                          Nenhuma reserva para esta variação
                        </div>
                      )}

                      {/* Waitlist */}
                      {variationDetails.waitlistEntries.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <ListOrdered className="h-4 w-4 text-amber-600" />
                            Lista de Espera ({variationDetails.waitlistEntries.length})
                          </h4>
                          {variationDetails.waitlistEntries.map((w, i) => (
                            <div
                              key={w.id}
                              className="flex items-center justify-between p-2 bg-amber-50 border border-amber-100 rounded-lg"
                            >
                              <div>
                                <span className="font-medium">{w.instagram_handle}</span>
                                {w.whatsapp && (
                                  <span className="text-xs text-muted-foreground ml-2">
                                    {w.whatsapp}
                                  </span>
                                )}
                              </div>
                              <Badge variant="outline">#{i + 1} na fila</Badge>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
