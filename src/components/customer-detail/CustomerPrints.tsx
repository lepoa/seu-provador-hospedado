import { useState } from "react";
import { Camera, Package, ExternalLink, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface PrintRequest {
  id: string;
  image_path: string;
  size: string | null;
  preference: string | null;
  status: string | null;
  created_at: string;
  linked_product_id: string | null;
}

interface LinkedProduct {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
}

interface CustomerPrintsProps {
  prints: PrintRequest[];
  linkedProducts: Record<string, LinkedProduct>;
}

export function CustomerPrints({ prints, linkedProducts }: CustomerPrintsProps) {
  const [selectedPrint, setSelectedPrint] = useState<PrintRequest | null>(null);

  const getImageUrl = (path: string) => {
    const { data } = supabase.storage.from("prints").getPublicUrl(path);
    return data.publicUrl;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(price);
  };

  if (prints.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum print enviado por esta cliente.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Prints Enviados ({prints.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {prints.map((print) => {
              const linkedProduct = print.linked_product_id 
                ? linkedProducts[print.linked_product_id] 
                : null;

              return (
                <div 
                  key={print.id} 
                  className="group relative cursor-pointer"
                  onClick={() => setSelectedPrint(print)}
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-secondary">
                    <img
                      src={getImageUrl(print.image_path)}
                      alt="Print enviado"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  
                  {/* Status badge */}
                  <Badge 
                    variant={linkedProduct ? "default" : "secondary"}
                    className="absolute top-2 right-2 text-xs"
                  >
                    {linkedProduct ? "Vinculado" : "Pendente"}
                  </Badge>

                  {/* Info overlay */}
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(print.created_at)}
                    </p>
                    {print.size && (
                      <p className="text-xs">Tam. {print.size}</p>
                    )}
                    {linkedProduct && (
                      <p className="text-xs text-primary truncate font-medium">
                        {linkedProduct.name}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Full-size print modal */}
      <Dialog open={!!selectedPrint} onOpenChange={() => setSelectedPrint(null)}>
        <DialogContent className="max-w-2xl">
          <DialogTitle className="sr-only">Detalhes do Print</DialogTitle>
          {selectedPrint && (
            <div className="space-y-4">
              <div className="aspect-square max-h-[60vh] rounded-lg overflow-hidden bg-secondary">
                <img
                  src={getImageUrl(selectedPrint.image_path)}
                  alt="Print enviado"
                  className="w-full h-full object-contain"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Enviado em {formatDate(selectedPrint.created_at)}
                  </p>
                  <Badge variant={selectedPrint.linked_product_id ? "default" : "secondary"}>
                    {selectedPrint.linked_product_id ? "Produto vinculado" : "Pendente de análise"}
                  </Badge>
                </div>

                {selectedPrint.size && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Tamanho:</span> {selectedPrint.size}
                  </p>
                )}

                {selectedPrint.preference && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Preferência:</span>{" "}
                    {selectedPrint.preference === "ajustado" ? "Mais ajustado" : "Mais soltinho"}
                  </p>
                )}

                {/* Linked product */}
                {selectedPrint.linked_product_id && linkedProducts[selectedPrint.linked_product_id] && (
                  <div className="p-3 bg-secondary/50 rounded-lg mt-3">
                    <p className="text-xs text-muted-foreground mb-2">Produto vinculado:</p>
                    <div className="flex items-center gap-3">
                      {linkedProducts[selectedPrint.linked_product_id].image_url && (
                        <img
                          src={linkedProducts[selectedPrint.linked_product_id].image_url}
                          alt={linkedProducts[selectedPrint.linked_product_id].name}
                          className="w-12 h-12 object-cover rounded"
                        />
                      )}
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {linkedProducts[selectedPrint.linked_product_id].name}
                        </p>
                        <p className="text-sm text-primary">
                          {formatPrice(linkedProducts[selectedPrint.linked_product_id].price)}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <a 
                          href={`/produto/${selectedPrint.linked_product_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="gap-1"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Ver
                        </a>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
