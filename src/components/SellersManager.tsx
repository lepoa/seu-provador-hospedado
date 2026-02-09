import { useState } from "react";
import { Plus, Edit2, User, Phone, Mail, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSellers, Seller } from "@/hooks/useSellers";

export function SellersManager() {
  const { sellers, isLoading, createSeller, updateSeller, toggleSellerActive, loadAllSellers } = useSellers();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSeller, setEditingSeller] = useState<Seller | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    whatsapp: "",
    email: "",
  });
  const [showInactive, setShowInactive] = useState(false);

  // Load all sellers when showing inactive
  useState(() => {
    if (showInactive) {
      loadAllSellers();
    }
  });

  const handleOpenDialog = (seller?: Seller) => {
    if (seller) {
      setEditingSeller(seller);
      setFormData({
        name: seller.name,
        whatsapp: seller.whatsapp || "",
        email: seller.email || "",
      });
    } else {
      setEditingSeller(null);
      setFormData({ name: "", whatsapp: "", email: "" });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) return;

    try {
      if (editingSeller) {
        await updateSeller(editingSeller.id, {
          name: formData.name,
          whatsapp: formData.whatsapp || null,
          email: formData.email || null,
        });
      } else {
        await createSeller({
          name: formData.name,
          whatsapp: formData.whatsapp || undefined,
          email: formData.email || undefined,
        });
      }
      setIsDialogOpen(false);
      setFormData({ name: "", whatsapp: "", email: "" });
      setEditingSeller(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  const displayedSellers = showInactive ? sellers : sellers.filter(s => s.is_active);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Equipe de Vendas</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setShowInactive(!showInactive);
              if (!showInactive) loadAllSellers();
            }}
          >
            {showInactive ? "Ocultar inativos" : "Mostrar inativos"}
          </Button>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Vendedora
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingSeller ? "Editar Vendedora" : "Cadastrar Vendedora"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  placeholder="Nome da vendedora"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              <div>
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  placeholder="(62) 99999-9999"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData(prev => ({ ...prev, whatsapp: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingSeller ? "Salvar" : "Cadastrar"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {displayedSellers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma vendedora cadastrada ainda.</p>
            <p className="text-sm mt-1">Clique em "Nova Vendedora" para começar.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {displayedSellers.map((seller) => (
            <Card key={seller.id} className={!seller.is_active ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{seller.name}</h3>
                      {!seller.is_active && (
                        <Badge variant="secondary" className="text-xs">Inativa</Badge>
                      )}
                    </div>
                    {seller.whatsapp && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        <span>{seller.whatsapp}</span>
                      </div>
                    )}
                    {seller.email && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Mail className="h-3 w-3" />
                        <span className="truncate">{seller.email}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => handleOpenDialog(seller)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => toggleSellerActive(seller.id, !seller.is_active)}
                      title={seller.is_active ? "Desativar" : "Ativar"}
                    >
                      {seller.is_active ? (
                        <ToggleRight className="h-4 w-4 text-green-600" />
                      ) : (
                        <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
