import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  Percent,
  DollarSign,
  Plus,
  Clock,
  Tag,
  Package,
  Store,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ProductDiscountSelector, ProductDiscountItem } from "./ProductDiscountSelector";
import { cn } from "@/lib/utils";
import type {
  PromotionalTable,
  PromotionalTableInsert,
  CategoryDiscount,
  ProductDiscount,
} from "@/types/promotionalTables";

interface PromotionalTableFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table?: PromotionalTable | null;
  onSubmit: (data: PromotionalTableInsert) => Promise<boolean>;
}

const CATEGORIES = [
  "vestidos",
  "blusas",
  "calças",
  "saias",
  "shorts",
  "conjuntos",
  "macacões",
  "casacos",
  "acessórios",
];

export function PromotionalTableFormModal({
  open,
  onOpenChange,
  table,
  onSubmit,
}: PromotionalTableFormModalProps) {
  const isEditing = !!table;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [channelScope, setChannelScope] = useState<"all" | "catalog" | "live">("all");

  // Scheduling
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [startTime, setStartTime] = useState("00:00");
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [endTime, setEndTime] = useState("23:59");

  // Store discount
  const [storeDiscountType, setStoreDiscountType] = useState<"percentage" | "fixed" | "">("");
  const [storeDiscountValue, setStoreDiscountValue] = useState("");
  const [storeMinOrderValue, setStoreMinOrderValue] = useState("");

  // Category discounts
  const [categoryDiscounts, setCategoryDiscounts] = useState<CategoryDiscount[]>([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryDiscountType, setNewCategoryDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [newCategoryDiscountValue, setNewCategoryDiscountValue] = useState("");

  // Product discounts (using the new selector format)
  const [productDiscounts, setProductDiscounts] = useState<ProductDiscountItem[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  // Reset form when modal opens/closes or table changes
  useEffect(() => {
    if (open) {
      if (table) {
        setName(table.name);
        setDescription(table.description || "");
        setIsActive(table.is_active);
        setPriority(table.priority);
        setChannelScope(table.channel_scope);
        
        if (table.start_at) {
          const start = new Date(table.start_at);
          setStartDate(start);
          setStartTime(format(start, "HH:mm"));
        } else {
          setStartDate(undefined);
          setStartTime("00:00");
        }
        
        if (table.end_at) {
          const end = new Date(table.end_at);
          setEndDate(end);
          setEndTime(format(end, "HH:mm"));
        } else {
          setEndDate(undefined);
          setEndTime("23:59");
        }
        
        setStoreDiscountType(table.store_discount_type || "");
        setStoreDiscountValue(table.store_discount_value?.toString() || "");
        setStoreMinOrderValue(table.store_min_order_value?.toString() || "");
        setCategoryDiscounts(table.category_discounts || []);
        // Convert ProductDiscount[] to ProductDiscountItem[] for the selector
        setProductDiscounts((table.product_discounts || []).map(pd => ({
          product_id: pd.product_id,
          product_name: pd.product_name,
          discount_type: pd.discount_type,
          discount_value: pd.discount_value,
          price_base: "current" as const,
        })));
      } else {
        // Reset to defaults for new table
        setName("");
        setDescription("");
        setIsActive(true);
        setPriority(0);
        setChannelScope("all");
        setStartDate(undefined);
        setStartTime("00:00");
        setEndDate(undefined);
        setEndTime("23:59");
        setStoreDiscountType("");
        setStoreDiscountValue("");
        setStoreMinOrderValue("");
        setCategoryDiscounts([]);
        setProductDiscounts([]);
      }
      // Reset new item fields
      setNewCategoryName("");
      setNewCategoryDiscountValue("");
    }
  }, [open, table]);

  const combineDateTime = (date: Date | undefined, time: string): string | null => {
    if (!date) return null;
    const [hours, minutes] = time.split(":").map(Number);
    const combined = new Date(date);
    combined.setHours(hours, minutes, 0, 0);
    return combined.toISOString();
  };

  const handleAddCategory = () => {
    if (!newCategoryName || !newCategoryDiscountValue) return;
    const exists = categoryDiscounts.find(c => c.category === newCategoryName);
    if (exists) {
      setCategoryDiscounts(prev =>
        prev.map(c =>
          c.category === newCategoryName
            ? { ...c, discount_type: newCategoryDiscountType, discount_value: parseFloat(newCategoryDiscountValue) }
            : c
        )
      );
    } else {
      setCategoryDiscounts(prev => [
        ...prev,
        {
          category: newCategoryName,
          discount_type: newCategoryDiscountType,
          discount_value: parseFloat(newCategoryDiscountValue),
        },
      ]);
    }
    setNewCategoryName("");
    setNewCategoryDiscountValue("");
  };

  const handleRemoveCategory = (category: string) => {
    setCategoryDiscounts(prev => prev.filter(c => c.category !== category));
  };

  // Convert ProductDiscountItem[] to ProductDiscount[] for saving
  const convertToProductDiscounts = (): ProductDiscount[] => {
    return productDiscounts.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      discount_type: item.discount_type,
      discount_value: item.discount_value,
    }));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      const data: PromotionalTableInsert = {
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
        priority,
        channel_scope: channelScope,
        start_at: combineDateTime(startDate, startTime),
        end_at: combineDateTime(endDate, endTime),
        store_discount_type: storeDiscountType || null,
        store_discount_value: storeDiscountValue ? parseFloat(storeDiscountValue) : null,
        store_min_order_value: storeMinOrderValue ? parseFloat(storeMinOrderValue) : null,
        category_discounts: categoryDiscounts,
        product_discounts: convertToProductDiscounts(),
        user_id: null,
      };

      const success = await onSubmit(data);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !flex-col sm:max-w-2xl max-h-[90vh] overflow-hidden p-0">
        {/* Fixed Header */}
        <DialogHeader className="shrink-0 p-4 sm:p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            {isEditing ? "Editar Tabela Promocional" : "Nova Tabela Promocional"}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Atualize as regras de preço e agendamento"
              : "Crie regras de desconto para loja, categorias ou produtos específicos"}
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-6">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Tabela *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Black Friday 2025"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Uso interno, não aparece para o cliente
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Detalhes sobre a promoção..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="is_active">Ativa</Label>
                </div>

                <div className="flex-1 space-y-1">
                  <Label>Canal</Label>
                  <Select value={channelScope} onValueChange={(v) => setChannelScope(v as any)}>
                    <SelectTrigger className="w-full sm:w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="catalog">Só Catálogo</SelectItem>
                      <SelectItem value="live">Só Live</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label>Prioridade</Label>
                  <Input
                    type="number"
                    min="0"
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                    className="w-20"
                  />
                </div>
              </div>
            </div>

            {/* Scheduling */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Agendamento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Início</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {startDate ? format(startDate, "dd/MM/yy") : "Data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={startDate}
                          onSelect={setStartDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "flex-1 justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                          )}
                        >
                          <Calendar className="mr-2 h-4 w-4" />
                          {endDate ? format(endDate, "dd/MM/yy") : "Data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarComponent
                          mode="single"
                          selected={endDate}
                          onSelect={setEndDate}
                          locale={ptBR}
                        />
                      </PopoverContent>
                    </Popover>
                    <Input
                      type="time"
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-24"
                    />
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Deixe vazio para promoção sem limite de tempo
              </p>
            </div>

            {/* Store-wide Discount */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Store className="h-4 w-4" />
                Desconto Geral da Loja
              </h3>
              <p className="text-sm text-muted-foreground">
                Aplica um desconto padrão para toda a loja
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tipo</Label>
                  <Select
                    value={storeDiscountType}
                    onValueChange={(v) => setStoreDiscountType(v as any)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        <span className="flex items-center gap-1">
                          <Percent className="h-3 w-3" /> Porcentagem
                        </span>
                      </SelectItem>
                      <SelectItem value="fixed">
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> Valor fixo
                        </span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Desconto</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min="0"
                      step={storeDiscountType === "percentage" ? "1" : "0.01"}
                      value={storeDiscountValue}
                      onChange={(e) => setStoreDiscountValue(e.target.value)}
                      placeholder="0"
                      disabled={!storeDiscountType}
                    />
                    {storeDiscountType && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                        {storeDiscountType === "percentage" ? "%" : "R$"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Valor Mínimo</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                      R$
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={storeMinOrderValue}
                      onChange={(e) => setStoreMinOrderValue(e.target.value)}
                      placeholder="0,00"
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Category Discounts */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Descontos por Categoria
              </h3>
              <p className="text-sm text-muted-foreground">
                Substituem o desconto geral da loja
              </p>

              {/* Existing category discounts */}
              {categoryDiscounts.length > 0 && (
                <div className="space-y-2">
                  {categoryDiscounts.map((cd) => (
                    <div
                      key={cd.category}
                      className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2"
                    >
                      <span className="capitalize font-medium">{cd.category}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">
                          {cd.discount_type === "percentage"
                            ? `${cd.discount_value}%`
                            : `R$ ${cd.discount_value.toFixed(2)}`}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleRemoveCategory(cd.category)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new category discount */}
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={newCategoryName} onValueChange={setNewCategoryName}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.filter(
                      (c) => !categoryDiscounts.find((cd) => cd.category === c)
                    ).map((cat) => (
                      <SelectItem key={cat} value={cat} className="capitalize">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={newCategoryDiscountType}
                  onValueChange={(v) => setNewCategoryDiscountType(v as any)}
                >
                  <SelectTrigger className="w-full sm:w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">R$</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  min="0"
                  placeholder="Valor"
                  value={newCategoryDiscountValue}
                  onChange={(e) => setNewCategoryDiscountValue(e.target.value)}
                  className="w-full sm:w-24"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName || !newCategoryDiscountValue}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Product Discounts */}
            <div className="border rounded-lg p-4 space-y-4">
              <h3 className="font-medium flex items-center gap-2">
                <Package className="h-4 w-4" />
                Descontos por Produto
              </h3>
              <p className="text-sm text-muted-foreground">
                Substituem descontos de categoria e geral. Busque e selecione produtos abaixo.
              </p>

              <ProductDiscountSelector
                value={productDiscounts}
                onChange={setProductDiscounts}
              />
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <DialogFooter className="shrink-0 p-4 sm:p-6 border-t bg-background">
          <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSaving || !name.trim()}
              className="w-full sm:w-auto"
            >
              {isSaving ? "Salvando..." : isEditing ? "Salvar Alterações" : "Criar Tabela"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
