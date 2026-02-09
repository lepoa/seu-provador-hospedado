import { useState, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus,
  Wand2,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Calendar,
  Gift,
  Pencil,
  Radio,
  ShoppingBag,
  Users,
  CreditCard,
  DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useGifts, useActiveGifts } from "@/hooks/useGifts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { GiftRule, CreateGiftRuleForm, GiftChannelScope, GiftConditionType } from "@/types/gifts";

const CHANNEL_LABELS: Record<GiftChannelScope, string> = {
  catalog_only: "Apenas Catálogo",
  live_only: "Apenas Lives",
  both: "Catálogo e Lives",
  live_specific: "Live Específica",
};

const CONDITION_LABELS: Record<GiftConditionType, string> = {
  all_purchases: "Todas as compras",
  min_value: "Valor mínimo",
  first_n_paid: "Primeiros N pagos",
  first_n_reserved: "Primeiros N reservados",
};

const CONDITION_ICONS: Record<GiftConditionType, typeof Users> = {
  all_purchases: ShoppingBag,
  min_value: DollarSign,
  first_n_paid: CreditCard,
  first_n_reserved: Users,
};

interface LiveEvent {
  id: string;
  titulo: string;
  status: string;
}

export function GiftRulesManager() {
  const { rules, isLoading, createRule, updateRule, toggleRuleActive, deleteRule } = useGifts();
  const { gifts: activeGifts } = useActiveGifts();
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<GiftRule | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formChannelScope, setFormChannelScope] = useState<GiftChannelScope>("both");
  const [formLiveEventId, setFormLiveEventId] = useState("");
  const [formStartAt, setFormStartAt] = useState<Date | undefined>();
  const [formEndAt, setFormEndAt] = useState<Date | undefined>();
  const [formPriority, setFormPriority] = useState("0");
  const [formConditionType, setFormConditionType] = useState<GiftConditionType>("all_purchases");
  const [formConditionValue, setFormConditionValue] = useState("");
  const [formGiftId, setFormGiftId] = useState("");
  const [formGiftQty, setFormGiftQty] = useState("1");
  const [formMaxPerCustomer, setFormMaxPerCustomer] = useState("1");
  const [formMaxTotalAwards, setFormMaxTotalAwards] = useState("");

  // Fetch live events for dropdown
  useEffect(() => {
    const fetchLives = async () => {
      const { data } = await supabase
        .from("live_events")
        .select("id, titulo, status")
        .in("status", ["planejada", "ao_vivo"])
        .order("data_hora_inicio", { ascending: false });
      setLiveEvents(data || []);
    };
    fetchLives();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormIsActive(true);
    setFormChannelScope("both");
    setFormLiveEventId("");
    setFormStartAt(undefined);
    setFormEndAt(undefined);
    setFormPriority("0");
    setFormConditionType("all_purchases");
    setFormConditionValue("");
    setFormGiftId("");
    setFormGiftQty("1");
    setFormMaxPerCustomer("1");
    setFormMaxTotalAwards("");
    setEditingRule(null);
  };

  const openCreateModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (rule: GiftRule) => {
    setEditingRule(rule);
    setFormName(rule.name);
    setFormIsActive(rule.is_active);
    setFormChannelScope(rule.channel_scope);
    setFormLiveEventId(rule.live_event_id || "");
    setFormStartAt(rule.start_at ? new Date(rule.start_at) : undefined);
    setFormEndAt(rule.end_at ? new Date(rule.end_at) : undefined);
    setFormPriority(rule.priority.toString());
    setFormConditionType(rule.condition_type);
    setFormConditionValue(rule.condition_value?.toString() || "");
    setFormGiftId(rule.gift_id);
    setFormGiftQty(rule.gift_qty.toString());
    setFormMaxPerCustomer(rule.max_per_customer?.toString() || "1");
    setFormMaxTotalAwards(rule.max_total_awards?.toString() || "");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Preencha o nome da regra");
      return;
    }

    if (!formGiftId) {
      toast.error("Selecione um brinde");
      return;
    }

    if (formChannelScope === "live_specific" && !formLiveEventId) {
      toast.error("Selecione uma live");
      return;
    }

    if ((formConditionType === "min_value" || formConditionType === "first_n_paid" || formConditionType === "first_n_reserved") && !formConditionValue) {
      toast.error("Informe o valor da condição");
      return;
    }

    setIsSaving(true);

    const data: CreateGiftRuleForm = {
      name: formName.trim(),
      is_active: formIsActive,
      channel_scope: formChannelScope,
      live_event_id: formChannelScope === "live_specific" ? formLiveEventId : undefined,
      start_at: formStartAt?.toISOString(),
      end_at: formEndAt?.toISOString(),
      priority: parseInt(formPriority) || 0,
      condition_type: formConditionType,
      condition_value: formConditionValue ? parseFloat(formConditionValue) : undefined,
      gift_id: formGiftId,
      gift_qty: parseInt(formGiftQty) || 1,
      max_per_customer: formMaxPerCustomer ? parseInt(formMaxPerCustomer) : undefined,
      max_total_awards: formMaxTotalAwards ? parseInt(formMaxTotalAwards) : undefined,
    };

    let success = false;
    if (editingRule) {
      success = await updateRule(editingRule.id, data);
    } else {
      const rule = await createRule(data);
      success = !!rule;
    }

    setIsSaving(false);

    if (success) {
      setShowModal(false);
      resetForm();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta regra?")) return;
    await deleteRule(id);
  };

  const filteredRules = rules.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.gift?.name.toLowerCase().includes(search.toLowerCase())
  );

  const getRuleStatus = (rule: GiftRule) => {
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

  const needsConditionValue = formConditionType === "min_value" || formConditionType === "first_n_paid" || formConditionType === "first_n_reserved";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Regras de Brindes
            </CardTitle>
            <CardDescription>
              Configure regras automáticas para aplicar brindes
            </CardDescription>
          </div>
          <Button onClick={openCreateModal}>
            <Plus className="h-4 w-4 mr-1" />
            Nova Regra
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar regras..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Wand2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhuma regra encontrada</p>
          </div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
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
                  const CondIcon = CONDITION_ICONS[rule.condition_type];
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
                        <div className="flex items-center gap-1.5">
                          <CondIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-sm">{CONDITION_LABELS[rule.condition_type]}</span>
                        </div>
                        {rule.condition_value && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {rule.condition_type === "min_value" ? `R$ ${rule.condition_value.toFixed(2)}` : `${rule.condition_value}`}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{CHANNEL_LABELS[rule.channel_scope]}</div>
                        {rule.live_event && (
                          <div className="text-xs text-muted-foreground truncate max-w-[120px]">
                            {rule.live_event.titulo}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {rule.current_awards_count}
                          {rule.max_total_awards && ` / ${rule.max_total_awards}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditModal(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => toggleRuleActive(rule.id, rule.is_active)}
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
          </div>
        )}
      </CardContent>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg p-0 max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="px-6 py-4 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              {editingRule ? "Editar Regra" : "Nova Regra"}
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 py-4 flex-1 min-h-0 overflow-y-auto space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label>Nome da Regra *</Label>
              <Input
                placeholder="Ex: Brinde acima de R$ 400"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {/* Gift */}
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2 space-y-2">
                <Label>Brinde *</Label>
                <Select value={formGiftId} onValueChange={setFormGiftId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {activeGifts.map((g) => (
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
                  value={formGiftQty}
                  onChange={(e) => setFormGiftQty(e.target.value)}
                />
              </div>
            </div>

            {/* Channel Scope */}
            <div className="space-y-2">
              <Label>Aplicar em</Label>
              <Select value={formChannelScope} onValueChange={(v) => setFormChannelScope(v as GiftChannelScope)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background z-50">
                  <SelectItem value="both">Catálogo e Lives</SelectItem>
                  <SelectItem value="catalog_only">Apenas Catálogo</SelectItem>
                  <SelectItem value="live_only">Apenas Lives</SelectItem>
                  <SelectItem value="live_specific">Live Específica</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Live Event (conditional) */}
            {formChannelScope === "live_specific" && (
              <div className="space-y-2">
                <Label>Live *</Label>
                <Select value={formLiveEventId} onValueChange={setFormLiveEventId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a live" />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    {liveEvents.map((le) => (
                      <SelectItem key={le.id} value={le.id}>
                        <span className="flex items-center gap-2">
                          <Radio className="h-3 w-3" />
                          {le.titulo}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Condition */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>Condição</Label>
                <Select value={formConditionType} onValueChange={(v) => setFormConditionType(v as GiftConditionType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-background z-50">
                    <SelectItem value="all_purchases">Todas as compras</SelectItem>
                    <SelectItem value="min_value">Valor mínimo</SelectItem>
                    <SelectItem value="first_n_paid">Primeiros N pagos</SelectItem>
                    <SelectItem value="first_n_reserved">Primeiros N reservados</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {needsConditionValue && (
                <div className="space-y-2">
                  <Label>
                    {formConditionType === "min_value" ? "Valor (R$)" : "Quantidade"}
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    step={formConditionType === "min_value" ? "0.01" : "1"}
                    value={formConditionValue}
                    onChange={(e) => setFormConditionValue(e.target.value)}
                    placeholder={formConditionType === "min_value" ? "400.00" : "10"}
                  />
                </div>
              )}
            </div>

            {/* Limits */}
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-2">
                <Label>Por cliente</Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxPerCustomer}
                  onChange={(e) => setFormMaxPerCustomer(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div className="space-y-2">
                <Label>Total máximo</Label>
                <Input
                  type="number"
                  min="1"
                  value={formMaxTotalAwards}
                  onChange={(e) => setFormMaxTotalAwards(e.target.value)}
                  placeholder="Ilimitado"
                />
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Input
                  type="number"
                  value={formPriority}
                  onChange={(e) => setFormPriority(e.target.value)}
                  placeholder="0"
                />
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

            {/* Active */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="ruleActive"
                checked={formIsActive}
                onCheckedChange={(c) => setFormIsActive(!!c)}
              />
              <label htmlFor="ruleActive" className="text-sm cursor-pointer">
                Regra ativa
              </label>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button variant="outline" onClick={() => setShowModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Salvando..." : editingRule ? "Salvar" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
