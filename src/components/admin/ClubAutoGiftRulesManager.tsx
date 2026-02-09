import { useState, useEffect, useCallback } from "react";
import {
  Wand2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Gift,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ArrowLeft,
  DollarSign,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
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
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface AutoGiftRule {
  id: string;
  name: string;
  channel_scope: string;
  condition_type: string;
  condition_value: number | null;
  gift_id: string;
  gift_qty: number;
  max_per_customer: number | null;
  max_total_awards: number | null;
  current_awards_count: number;
  priority: number;
  start_at: string | null;
  end_at: string | null;
  is_active: boolean;
  gift?: {
    name: string;
    image_url: string | null;
  };
}

interface GiftItem {
  id: string;
  name: string;
  image_url: string | null;
}

interface LoyaltyTier {
  slug: string;
  name: string;
}

const CHANNEL_OPTIONS = [
  { value: "catalog_only", label: "Apenas Catálogo" },
  { value: "live_only", label: "Apenas Lives" },
  { value: "both", label: "Catálogo e Lives" },
];

const CONDITION_OPTIONS = [
  { value: "all_purchases", label: "Todas as compras" },
  { value: "min_value", label: "Valor mínimo" },
  { value: "first_n_paid", label: "Primeiros N pagos" },
];

interface ClubAutoGiftRulesManagerProps {
  onBack: () => void;
}

export function ClubAutoGiftRulesManager({ onBack }: ClubAutoGiftRulesManagerProps) {
  const [rules, setRules] = useState<AutoGiftRule[]>([]);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<AutoGiftRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    channel_scope: "both",
    condition_type: "min_value",
    condition_value: 300,
    gift_id: "",
    gift_qty: 1,
    max_per_customer: 1,
    max_total_awards: null as number | null,
    priority: 0,
    start_at: null as Date | null,
    end_at: null as Date | null,
    is_active: true,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesRes, giftsRes, tiersRes] = await Promise.all([
        supabase
          .from("gift_rules")
          .select("*, gift:gifts(name, image_url)")
          .order("priority", { ascending: false }),
        supabase
          .from("gifts")
          .select("id, name, image_url")
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("loyalty_tiers")
          .select("slug, name")
          .eq("is_active", true)
          .order("display_order"),
      ]);

      if (rulesRes.data) setRules(rulesRes.data);
      if (giftsRes.data) setGifts(giftsRes.data);
      if (tiersRes.data) setTiers(tiersRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({
      name: "",
      channel_scope: "both",
      condition_type: "min_value",
      condition_value: 300,
      gift_id: "",
      gift_qty: 1,
      max_per_customer: 1,
      max_total_awards: null,
      priority: 0,
      start_at: null,
      end_at: null,
      is_active: true,
    });
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (rule: AutoGiftRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      channel_scope: rule.channel_scope,
      condition_type: rule.condition_type,
      condition_value: rule.condition_value || 0,
      gift_id: rule.gift_id,
      gift_qty: rule.gift_qty,
      max_per_customer: rule.max_per_customer || 1,
      max_total_awards: rule.max_total_awards,
      priority: rule.priority,
      start_at: rule.start_at ? new Date(rule.start_at) : null,
      end_at: rule.end_at ? new Date(rule.end_at) : null,
      is_active: rule.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.gift_id) {
      toast.error("Selecione um brinde");
      return;
    }
    if (form.condition_type === "min_value" && (!form.condition_value || form.condition_value <= 0)) {
      toast.error("Valor mínimo deve ser maior que zero");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        channel_scope: form.channel_scope as "catalog_only" | "live_only" | "both" | "live_specific",
        condition_type: form.condition_type as "all_purchases" | "min_value" | "first_n_paid" | "first_n_reserved",
        condition_value: form.condition_value || null,
        gift_id: form.gift_id,
        gift_qty: form.gift_qty,
        max_per_customer: form.max_per_customer,
        max_total_awards: form.max_total_awards,
        priority: form.priority,
        start_at: form.start_at?.toISOString() || null,
        end_at: form.end_at?.toISOString() || null,
        is_active: form.is_active,
      };

      if (editingRule) {
        const { error } = await supabase
          .from("gift_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
        toast.success("Regra atualizada!");
      } else {
        const { error } = await supabase
          .from("gift_rules")
          .insert(payload);
        if (error) throw error;
        toast.success("Regra criada!");
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving rule:", error);
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      const { error } = await supabase
        .from("gift_rules")
        .update({ is_active: !currentlyActive })
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta regra?")) return;
    try {
      const { error } = await supabase
        .from("gift_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Regra excluída");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const filteredRules = rules.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = channelFilter === "all" || r.channel_scope === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const getRuleStatus = (rule: AutoGiftRule) => {
    if (!rule.is_active) return { label: "Inativa", variant: "secondary" as const };
    const now = new Date();
    if (rule.start_at && new Date(rule.start_at) > now) {
      return { label: "Agendada", variant: "outline" as const };
    }
    if (rule.end_at && new Date(rule.end_at) < now) {
      return { label: "Expirada", variant: "destructive" as const };
    }
    if (rule.max_total_awards && rule.current_awards_count >= rule.max_total_awards) {
      return { label: "Esgotada", variant: "destructive" as const };
    }
    return { label: "Ativa", variant: "default" as const };
  };

  const needsConditionValue = form.condition_type === "min_value" || form.condition_type === "first_n_paid";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-serif">Brindes Automáticos</h2>
          <p className="text-sm text-muted-foreground">
            Regras para adicionar brindes automaticamente ao carrinho
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Regra
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar regras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Canal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os canais</SelectItem>
            {CHANNEL_OPTIONS.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredRules.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma regra encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Regra</TableHead>
                  <TableHead>Brinde</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Aplicações</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.map((rule) => {
                  const status = getRuleStatus(rule);
                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                        <div className="text-xs text-muted-foreground">
                          Prioridade: {rule.priority}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-secondary rounded overflow-hidden shrink-0">
                            {rule.gift?.image_url ? (
                              <img src={rule.gift.image_url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Gift className="h-3 w-3 text-muted-foreground" />
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm">{rule.gift?.name || "—"}</div>
                            <div className="text-xs text-muted-foreground">x{rule.gift_qty}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {CONDITION_OPTIONS.find((c) => c.value === rule.condition_type)?.label}
                        </div>
                        {rule.condition_value && (
                          <div className="text-xs text-muted-foreground">
                            {rule.condition_type === "min_value"
                              ? `R$ ${rule.condition_value.toFixed(2)}`
                              : rule.condition_value}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {CHANNEL_OPTIONS.find((c) => c.value === rule.channel_scope)?.label || rule.channel_scope}
                      </TableCell>
                      <TableCell>
                        {rule.current_awards_count}
                        {rule.max_total_awards && ` / ${rule.max_total_awards}`}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(rule.id, rule.is_active)}
                          >
                            {rule.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(rule.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? "Editar Regra" : "Nova Regra de Brinde"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome da Regra *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Brinde acima de R$ 400"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <Label>Brinde *</Label>
                <Select value={form.gift_id} onValueChange={(v) => setForm({ ...form, gift_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {gifts.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        <span className="flex items-center gap-2">
                          <Gift className="h-3 w-3" />
                          {g.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Qtd</Label>
                <Input
                  type="number"
                  min="1"
                  value={form.gift_qty}
                  onChange={(e) => setForm({ ...form, gift_qty: Number(e.target.value) || 1 })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Aplicar em</Label>
              <Select
                value={form.channel_scope}
                onValueChange={(v) => setForm({ ...form, channel_scope: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_OPTIONS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select
                  value={form.condition_type}
                  onValueChange={(v) => setForm({ ...form, condition_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {needsConditionValue && (
                <div className="space-y-2">
                  <Label>
                    {form.condition_type === "min_value" ? "Valor mínimo (R$)" : "Quantidade"}
                  </Label>
                  <Input
                    type="number"
                    value={form.condition_value}
                    onChange={(e) => setForm({ ...form, condition_value: Number(e.target.value) })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Máx. por cliente</Label>
                <Input
                  type="number"
                  value={form.max_per_customer}
                  onChange={(e) => setForm({ ...form, max_per_customer: Number(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. total (vazio = ilimitado)</Label>
                <Input
                  type="number"
                  value={form.max_total_awards || ""}
                  onChange={(e) =>
                    setForm({ ...form, max_total_awards: e.target.value ? Number(e.target.value) : null })
                  }
                  placeholder="Ilimitado"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prioridade (maior = preferência)</Label>
              <Input
                type="number"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.start_at && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {form.start_at
                        ? format(form.start_at, "dd/MM/yyyy", { locale: ptBR })
                        : "Imediato"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={form.start_at || undefined}
                      onSelect={(d) => setForm({ ...form, start_at: d || null })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.end_at && "text-muted-foreground"
                      )}
                    >
                      <Calendar className="mr-2 h-4 w-4" />
                      {form.end_at
                        ? format(form.end_at, "dd/MM/yyyy", { locale: ptBR })
                        : "Sem limite"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <CalendarComponent
                      mode="single"
                      selected={form.end_at || undefined}
                      onSelect={(d) => setForm({ ...form, end_at: d || null })}
                      locale={ptBR}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Regra ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
