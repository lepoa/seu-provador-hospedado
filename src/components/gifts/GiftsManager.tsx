import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Gift,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Calendar,
  Package,
  Infinity,
  Pencil,
  Image,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { useGifts } from "@/hooks/useGifts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Gift as GiftType, CreateGiftForm } from "@/types/gifts";

export function GiftsManager() {
  const { gifts, isLoading, createGift, updateGift, toggleGiftActive, deleteGift } = useGifts();
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingGift, setEditingGift] = useState<GiftType | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStockQty, setFormStockQty] = useState("");
  const [formUnlimitedStock, setFormUnlimitedStock] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formStartAt, setFormStartAt] = useState<Date | undefined>();
  const [formEndAt, setFormEndAt] = useState<Date | undefined>();
  const [formRequireConfirm, setFormRequireConfirm] = useState(false);
  const [formCost, setFormCost] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormImageUrl("");
    setFormDescription("");
    setFormStockQty("");
    setFormUnlimitedStock(false);
    setFormIsActive(true);
    setFormStartAt(undefined);
    setFormEndAt(undefined);
    setFormRequireConfirm(false);
    setFormCost("");
    setEditingGift(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (gift: GiftType) => {
    setEditingGift(gift);
    setFormName(gift.name);
    setFormImageUrl(gift.image_url || "");
    setFormDescription(gift.description || "");
    setFormStockQty(gift.stock_qty.toString());
    setFormUnlimitedStock(gift.unlimited_stock);
    setFormIsActive(gift.is_active);
    setFormStartAt(gift.start_at ? new Date(gift.start_at) : undefined);
    setFormEndAt(gift.end_at ? new Date(gift.end_at) : undefined);
    setFormRequireConfirm(gift.require_manual_confirm);
    setFormCost(gift.cost?.toString() || "");
    setShowModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `gift-${Date.now()}.${fileExt}`;
      const filePath = `gifts/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('products')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('products')
        .getPublicUrl(filePath);

      setFormImageUrl(publicUrl);
      toast.success("Imagem enviada!");
    } catch (err) {
      console.error("Error uploading image:", err);
      toast.error("Erro ao enviar imagem");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Preencha o nome do brinde");
      return;
    }

    if (!formUnlimitedStock && !formStockQty) {
      toast.error("Informe a quantidade em estoque ou marque como ilimitado");
      return;
    }

    setIsSaving(true);

    const data: CreateGiftForm = {
      name: formName.trim(),
      image_url: formImageUrl || undefined,
      description: formDescription || undefined,
      stock_qty: formUnlimitedStock ? 0 : parseInt(formStockQty) || 0,
      unlimited_stock: formUnlimitedStock,
      is_active: formIsActive,
      start_at: formStartAt?.toISOString(),
      end_at: formEndAt?.toISOString(),
      require_manual_confirm: formRequireConfirm,
      cost: formCost ? parseFloat(formCost) : undefined,
    };

    let success = false;
    if (editingGift) {
      success = await updateGift(editingGift.id, data);
    } else {
      const gift = await createGift(data);
      success = !!gift;
    }

    setIsSaving(false);

    if (success) {
      setShowModal(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este brinde?")) return;
    await deleteGift(id);
  };

  const filteredGifts = gifts.filter(g =>
    g.name.toLowerCase().includes(search.toLowerCase()) ||
    g.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const getGiftStatus = (gift: GiftType) => {
    if (!gift.is_active) return { label: "Inativo", variant: "secondary" as const };
    
    const now = new Date();
    if (gift.start_at && new Date(gift.start_at) > now) {
      return { label: "Agendado", variant: "outline" as const };
    }
    if (gift.end_at && new Date(gift.end_at) < now) {
      return { label: "Expirado", variant: "destructive" as const };
    }
    if (!gift.unlimited_stock && gift.stock_qty <= 0) {
      return { label: "Sem estoque", variant: "destructive" as const };
    }
    return { label: "Ativo", variant: "default" as const };
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Brindes
            </CardTitle>
            <CardDescription>
              Cadastre brindes para regras automáticas e sorteios
            </CardDescription>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Brinde
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-secondary/50 rounded-lg text-center">
            <div className="text-2xl font-bold">{gifts.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {gifts.filter(g => getGiftStatus(g).label === "Ativo").length}
            </div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-600">
              {gifts.filter(g => g.unlimited_stock).length}
            </div>
            <div className="text-xs text-muted-foreground">Ilimitados</div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredGifts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum brinde encontrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Brinde</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Estoque</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredGifts.map((gift) => {
                  const status = getGiftStatus(gift);
                  return (
                    <TableRow key={gift.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
                            {gift.image_url ? (
                              <img src={gift.image_url} alt={gift.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Gift className="h-4 w-4 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{gift.name}</div>
                            {gift.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {gift.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-secondary px-1 py-0.5 rounded">{gift.sku}</code>
                      </TableCell>
                      <TableCell>
                        {gift.unlimited_stock ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Infinity className="h-3 w-3" /> Ilimitado
                          </span>
                        ) : (
                          <span className={gift.stock_qty <= 0 ? "text-destructive" : ""}>
                            {gift.stock_qty} un
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {gift.start_at && (
                            <div>De: {format(new Date(gift.start_at), "dd/MM/yy", { locale: ptBR })}</div>
                          )}
                          {gift.end_at && (
                            <div>Até: {format(new Date(gift.end_at), "dd/MM/yy", { locale: ptBR })}</div>
                          )}
                          {!gift.start_at && !gift.end_at && (
                            <span className="text-muted-foreground">Sem limite</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(gift)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleGiftActive(gift.id, gift.is_active)}
                            title={gift.is_active ? "Desativar" : "Ativar"}
                          >
                            {gift.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(gift.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg p-0 max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              {editingGift ? "Editar Brinde" : "Novo Brinde"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Nome do Brinde *</Label>
              <Input
                placeholder="Ex: Brinco Semijoia"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Image */}
            <div className="space-y-2">
              <Label>Foto</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="URL da imagem ou envie"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  className="flex-1"
                />
                <Button variant="outline" size="icon" asChild disabled={isUploading}>
                  <label className="cursor-pointer">
                    <Upload className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                </Button>
              </div>
              {formImageUrl && (
                <div className="w-20 h-20 rounded overflow-hidden border">
                  <img src={formImageUrl} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Breve descrição do brinde"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={2}
              />
            </div>

            {/* Stock */}
            <div className="space-y-2">
              <Label>Estoque</Label>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="unlimited"
                    checked={formUnlimitedStock}
                    onCheckedChange={(c) => setFormUnlimitedStock(!!c)}
                  />
                  <label htmlFor="unlimited" className="text-sm cursor-pointer">
                    Ilimitado
                  </label>
                </div>
                {!formUnlimitedStock && (
                  <Input
                    type="number"
                    min="0"
                    placeholder="Quantidade"
                    value={formStockQty}
                    onChange={(e) => setFormStockQty(e.target.value)}
                    className="w-32"
                  />
                )}
              </div>
            </div>

            {/* Validity */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !formStartAt && "text-muted-foreground")}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formStartAt ? format(formStartAt, "dd/MM/yy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formStartAt}
                      onSelect={setFormStartAt}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data de Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !formEndAt && "text-muted-foreground")}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formEndAt ? format(formEndAt, "dd/MM/yy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formEndAt}
                      onSelect={setFormEndAt}
                      locale={ptBR}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Cost */}
            <div className="space-y-2">
              <Label>Custo (interno, opcional)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="R$ 0,00"
                value={formCost}
                onChange={(e) => setFormCost(e.target.value)}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="active"
                  checked={formIsActive}
                  onCheckedChange={(c) => setFormIsActive(!!c)}
                />
                <label htmlFor="active" className="text-sm cursor-pointer">
                  Brinde ativo
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="confirm"
                  checked={formRequireConfirm}
                  onCheckedChange={(c) => setFormRequireConfirm(!!c)}
                />
                <label htmlFor="confirm" className="text-sm cursor-pointer">
                  Requer confirmação manual na separação
                </label>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingGift ? "Salvar" : "Criar Brinde"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
