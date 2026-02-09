import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Ticket,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Calendar,
  Percent,
  DollarSign,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Coupon {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  times_used: number;
  min_order_value: number | null;
  is_active: boolean;
  created_at: string;
}

export function CouponsManager() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form state
  const [formCode, setFormCode] = useState("");
  const [formDiscountType, setFormDiscountType] = useState<"percentage" | "fixed">("percentage");
  const [formDiscountValue, setFormDiscountValue] = useState("");
  const [formStartsAt, setFormStartsAt] = useState<Date | undefined>();
  const [formEndsAt, setFormEndsAt] = useState<Date | undefined>();
  const [formMaxUses, setFormMaxUses] = useState("");
  const [formMinOrderValue, setFormMinOrderValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCoupons((data || []) as Coupon[]);
    } catch (err) {
      console.error("Error fetching coupons:", err);
      toast.error("Erro ao carregar cupons");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setFormCode("");
    setFormDiscountType("percentage");
    setFormDiscountValue("");
    setFormStartsAt(undefined);
    setFormEndsAt(undefined);
    setFormMaxUses("");
    setFormMinOrderValue("");
  };

  const handleCreate = async () => {
    if (!formCode.trim() || !formDiscountValue) {
      toast.error("Preencha o código e o valor do desconto");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("coupons").insert({
        code: formCode.toUpperCase().trim(),
        discount_type: formDiscountType,
        discount_value: parseFloat(formDiscountValue),
        starts_at: formStartsAt?.toISOString() || null,
        ends_at: formEndsAt?.toISOString() || null,
        max_uses: formMaxUses ? parseInt(formMaxUses) : null,
        min_order_value: formMinOrderValue ? parseFloat(formMinOrderValue) : null,
      });

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um cupom com este código");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Cupom criado com sucesso!");
      setShowCreateModal(false);
      resetForm();
      fetchCoupons();
    } catch (err) {
      console.error("Error creating coupon:", err);
      toast.error("Erro ao criar cupom");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: !coupon.is_active })
        .eq("id", coupon.id);

      if (error) throw error;

      setCoupons((prev) =>
        prev.map((c) =>
          c.id === coupon.id ? { ...c, is_active: !c.is_active } : c
        )
      );
      toast.success(coupon.is_active ? "Cupom desativado" : "Cupom ativado");
    } catch (err) {
      console.error("Error toggling coupon:", err);
      toast.error("Erro ao atualizar cupom");
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este cupom?")) return;

    try {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;

      setCoupons((prev) => prev.filter((c) => c.id !== id));
      toast.success("Cupom excluído");
    } catch (err) {
      console.error("Error deleting coupon:", err);
      toast.error("Erro ao excluir cupom");
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const filteredCoupons = coupons.filter((c) =>
    c.code.toLowerCase().includes(search.toLowerCase())
  );

  const getCouponStatus = (coupon: Coupon) => {
    if (!coupon.is_active) return { label: "Inativo", variant: "secondary" as const };
    
    const now = new Date();
    if (coupon.starts_at && new Date(coupon.starts_at) > now) {
      return { label: "Agendado", variant: "outline" as const };
    }
    if (coupon.ends_at && new Date(coupon.ends_at) < now) {
      return { label: "Expirado", variant: "destructive" as const };
    }
    if (coupon.max_uses && coupon.times_used >= coupon.max_uses) {
      return { label: "Esgotado", variant: "destructive" as const };
    }
    return { label: "Ativo", variant: "default" as const };
  };

  const formatDiscount = (coupon: Coupon) => {
    if (coupon.discount_type === "percentage") {
      return `${coupon.discount_value}%`;
    }
    return `R$ ${coupon.discount_value.toFixed(2)}`;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Cupons de Desconto
            </CardTitle>
            <CardDescription>
              Gerencie cupons promocionais para suas vendas
            </CardDescription>
          </div>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-1" />
            Novo Cupom
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="p-3 bg-secondary/50 rounded-lg text-center">
            <div className="text-2xl font-bold">{coupons.length}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-green-600">
              {coupons.filter((c) => getCouponStatus(c).label === "Ativo").length}
            </div>
            <div className="text-xs text-muted-foreground">Ativos</div>
          </div>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center">
            <div className="text-2xl font-bold text-amber-600">
              {coupons.reduce((sum, c) => sum + c.times_used, 0)}
            </div>
            <div className="text-xs text-muted-foreground">Usos</div>
          </div>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando...
          </div>
        ) : filteredCoupons.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Ticket className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum cupom encontrado</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Desconto</TableHead>
                  <TableHead>Validade</TableHead>
                  <TableHead>Usos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCoupons.map((coupon) => {
                  const status = getCouponStatus(coupon);
                  return (
                    <TableRow key={coupon.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <code className="font-mono font-bold bg-secondary px-2 py-1 rounded">
                            {coupon.code}
                          </code>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => copyCode(coupon.code)}
                          >
                            {copiedCode === coupon.code ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {coupon.discount_type === "percentage" ? (
                            <Percent className="h-3 w-3" />
                          ) : (
                            <DollarSign className="h-3 w-3" />
                          )}
                          {formatDiscount(coupon)}
                        </div>
                        {coupon.min_order_value && (
                          <div className="text-xs text-muted-foreground">
                            Mín: R$ {coupon.min_order_value.toFixed(2)}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {coupon.starts_at && (
                            <div>
                              De:{" "}
                              {format(new Date(coupon.starts_at), "dd/MM/yy", {
                                locale: ptBR,
                              })}
                            </div>
                          )}
                          {coupon.ends_at && (
                            <div>
                              Até:{" "}
                              {format(new Date(coupon.ends_at), "dd/MM/yy", {
                                locale: ptBR,
                              })}
                            </div>
                          )}
                          {!coupon.starts_at && !coupon.ends_at && (
                            <span className="text-muted-foreground">
                              Sem limite
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {coupon.times_used}
                          {coupon.max_uses && ` / ${coupon.max_uses}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleActive(coupon)}
                            title={coupon.is_active ? "Desativar" : "Ativar"}
                          >
                            {coupon.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteCoupon(coupon.id)}
                          >
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

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ticket className="h-5 w-5" />
              Novo Cupom
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Code */}
            <div className="space-y-2">
              <Label>Código do Cupom *</Label>
              <Input
                placeholder="Ex: DESCONTO10"
                value={formCode}
                onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                className="font-mono"
              />
            </div>

            {/* Discount Type & Value */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Tipo de Desconto *</Label>
                <Select
                  value={formDiscountType}
                  onValueChange={(v) => setFormDiscountType(v as "percentage" | "fixed")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
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
                <Label>Valor *</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step={formDiscountType === "percentage" ? "1" : "0.01"}
                    max={formDiscountType === "percentage" ? "100" : undefined}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(e.target.value)}
                    placeholder={formDiscountType === "percentage" ? "10" : "15.00"}
                    className="pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
                    {formDiscountType === "percentage" ? "%" : "R$"}
                  </span>
                </div>
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formStartsAt && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formStartsAt
                        ? format(formStartsAt, "dd/MM/yy")
                        : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formStartsAt}
                      onSelect={setFormStartsAt}
                      initialFocus
                      className="pointer-events-auto"
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
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formEndsAt && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {formEndsAt
                        ? format(formEndsAt, "dd/MM/yy")
                        : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={formEndsAt}
                      onSelect={setFormEndsAt}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Limits */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Nº Máximo de Usos</Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxUses}
                  onChange={(e) => setFormMaxUses(e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label>Pedido Mínimo (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formMinOrderValue}
                  onChange={(e) => setFormMinOrderValue(e.target.value)}
                  placeholder="Sem mínimo"
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={isSaving}>
              {isSaving ? "Criando..." : "Criar Cupom"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
