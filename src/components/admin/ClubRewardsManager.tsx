import { useState, useEffect, useCallback } from "react";
import {
  Gift,
  Plus,
  Pencil,
  Trash2,
  Search,
  Star,
  Truck,
  Percent,
  Crown,
  Package,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ClubReward {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  type: string;
  points_cost: number;
  discount_value: number | null;
  min_tier: string;
  min_order_value: number | null;
  channel: string;
  max_per_customer: number | null;
  stock_qty: number | null;
  unlimited_stock: boolean;
  is_active: boolean;
  is_featured: boolean;
  current_redemptions: number;
  created_at: string;
}

interface LoyaltyTier {
  id: string;
  slug: string;
  name: string;
}

const REWARD_TYPES = [
  { value: "discount_fixed", label: "Desconto fixo (R$)", icon: Percent },
  { value: "discount_percentage", label: "Desconto (%)", icon: Percent },
  { value: "free_shipping", label: "Frete grátis", icon: Truck },
  { value: "gift", label: "Brinde físico", icon: Gift },
  { value: "vip_access", label: "Acesso VIP", icon: Crown },
];

const CHANNEL_OPTIONS = [
  { value: "catalog", label: "Apenas Catálogo" },
  { value: "live", label: "Apenas Lives" },
  { value: "both", label: "Catálogo e Lives" },
];

interface ClubRewardsManagerProps {
  onBack: () => void;
}

export function ClubRewardsManager({ onBack }: ClubRewardsManagerProps) {
  const [rewards, setRewards] = useState<ClubReward[]>([]);
  const [tiers, setTiers] = useState<LoyaltyTier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingReward, setEditingReward] = useState<ClubReward | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: "",
    description: "",
    type: "discount_fixed",
    points_cost: 1000,
    discount_value: 30,
    min_tier: "poa",
    min_order_value: 0,
    channel: "catalog",
    max_per_customer: 1,
    stock_qty: null as number | null,
    unlimited_stock: true,
    is_active: true,
    is_featured: false,
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rewardsRes, tiersRes] = await Promise.all([
        supabase
          .from("loyalty_rewards")
          .select("*")
          .order("points_cost", { ascending: true }),
        supabase
          .from("loyalty_tiers")
          .select("id, slug, name")
          .eq("is_active", true)
          .order("display_order"),
      ]);

      if (rewardsRes.data) setRewards(rewardsRes.data);
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
      description: "",
      type: "discount_fixed",
      points_cost: 1000,
      discount_value: 30,
      min_tier: "poa",
      min_order_value: 0,
      channel: "catalog",
      max_per_customer: 1,
      stock_qty: null,
      unlimited_stock: true,
      is_active: true,
      is_featured: false,
    });
    setEditingReward(null);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (reward: ClubReward) => {
    setEditingReward(reward);
    setForm({
      name: reward.name,
      description: reward.description || "",
      type: reward.type,
      points_cost: reward.points_cost,
      discount_value: reward.discount_value || 0,
      min_tier: reward.min_tier,
      min_order_value: reward.min_order_value || 0,
      channel: reward.channel || "catalog",
      max_per_customer: reward.max_per_customer || 1,
      stock_qty: reward.stock_qty,
      unlimited_stock: reward.unlimited_stock,
      is_active: reward.is_active,
      is_featured: reward.is_featured,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (form.points_cost <= 0) {
      toast.error("Custo em pontos deve ser maior que zero");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || null,
        type: form.type as "discount_fixed" | "discount_percentage" | "free_shipping" | "gift" | "vip_access",
        points_cost: form.points_cost,
        discount_value: form.discount_value || null,
        min_tier: form.min_tier as "poa" | "classica" | "icone" | "poa_black" | "atelier",
        min_order_value: form.min_order_value || null,
        channel: form.channel,
        max_per_customer: form.max_per_customer,
        stock_qty: form.unlimited_stock ? null : form.stock_qty,
        unlimited_stock: form.unlimited_stock,
        is_active: form.is_active,
        is_featured: form.is_featured,
      };

      if (editingReward) {
        const { error } = await supabase
          .from("loyalty_rewards")
          .update(payload)
          .eq("id", editingReward.id);
        if (error) throw error;
        toast.success("Recompensa atualizada!");
      } else {
        const { error } = await supabase
          .from("loyalty_rewards")
          .insert(payload);
        if (error) throw error;
        toast.success("Recompensa criada!");
      }

      setShowModal(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error("Error saving reward:", error);
      toast.error(error.message || "Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (id: string, currentlyActive: boolean) => {
    try {
      const { error } = await supabase
        .from("loyalty_rewards")
        .update({ is_active: !currentlyActive })
        .eq("id", id);
      if (error) throw error;
      fetchData();
    } catch (error) {
      toast.error("Erro ao alterar status");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta recompensa?")) return;
    try {
      const { error } = await supabase
        .from("loyalty_rewards")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Recompensa excluída");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir");
    }
  };

  const filteredRewards = rewards.filter((r) => {
    const matchesSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchesChannel = channelFilter === "all" || r.channel === channelFilter;
    return matchesSearch && matchesChannel;
  });

  const getTypeIcon = (type: string) => {
    const t = REWARD_TYPES.find((rt) => rt.value === type);
    return t?.icon || Gift;
  };

  const getTierName = (slug: string) => {
    return tiers.find((t) => t.slug === slug)?.name || slug;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-serif">Recompensas por Pontos</h2>
          <p className="text-sm text-muted-foreground">
            Catálogo de itens que clientes podem resgatar com Poás
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Recompensa
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar recompensas..."
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
          ) : filteredRewards.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Gift className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma recompensa encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recompensa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pontos</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead>Nível mín.</TableHead>
                  <TableHead>Resgates</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRewards.map((reward) => {
                  const TypeIcon = getTypeIcon(reward.type);
                  return (
                    <TableRow key={reward.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            <TypeIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {reward.name}
                              {reward.is_featured && (
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                              )}
                            </div>
                            {reward.description && (
                              <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {reward.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {REWARD_TYPES.find((t) => t.value === reward.type)?.label || reward.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{reward.points_cost}</span>
                        <span className="text-muted-foreground text-xs ml-1">pts</span>
                      </TableCell>
                      <TableCell>
                        {CHANNEL_OPTIONS.find((c) => c.value === reward.channel)?.label || reward.channel}
                      </TableCell>
                      <TableCell>{getTierName(reward.min_tier)}</TableCell>
                      <TableCell>
                        {reward.current_redemptions}
                        {!reward.unlimited_stock && reward.stock_qty !== null && (
                          <span className="text-muted-foreground">/{reward.stock_qty}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={reward.is_active ? "default" : "secondary"}>
                          {reward.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(reward)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleActive(reward.id, reward.is_active)}
                          >
                            {reward.is_active ? (
                              <ToggleRight className="h-4 w-4 text-green-600" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(reward.id)}>
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
              {editingReward ? "Editar Recompensa" : "Nova Recompensa"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ex: Cupom R$ 30"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Descrição curta da recompensa"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REWARD_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Custo em Pontos *</Label>
                <Input
                  type="number"
                  value={form.points_cost}
                  onChange={(e) => setForm({ ...form, points_cost: Number(e.target.value) })}
                />
              </div>
            </div>

            {(form.type === "discount_fixed" || form.type === "discount_percentage" || form.type === "free_shipping") && (
              <div className="space-y-2">
                <Label>
                  Valor do desconto {form.type === "discount_percentage" ? "(%)" : "(R$)"}
                </Label>
                <Input
                  type="number"
                  value={form.discount_value}
                  onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={form.channel}
                  onValueChange={(v) => setForm({ ...form, channel: v })}
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
              <div className="space-y-2">
                <Label>Nível mínimo</Label>
                <Select
                  value={form.min_tier}
                  onValueChange={(v) => setForm({ ...form, min_tier: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.map((t) => (
                      <SelectItem key={t.slug} value={t.slug}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor mín. do pedido (R$)</Label>
                <Input
                  type="number"
                  value={form.min_order_value}
                  onChange={(e) => setForm({ ...form, min_order_value: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Máx. por cliente (30 dias)</Label>
                <Input
                  type="number"
                  value={form.max_per_customer}
                  onChange={(e) => setForm({ ...form, max_per_customer: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.unlimited_stock}
                  onCheckedChange={(v) => setForm({ ...form, unlimited_stock: v })}
                />
                <Label>Estoque ilimitado</Label>
              </div>

              {!form.unlimited_stock && (
                <div className="space-y-2">
                  <Label>Quantidade em estoque</Label>
                  <Input
                    type="number"
                    value={form.stock_qty || ""}
                    onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) || null })}
                  />
                </div>
              )}

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_featured}
                  onCheckedChange={(v) => setForm({ ...form, is_featured: v })}
                />
                <Label>Destaque (aparece primeiro)</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
                <Label>Ativo</Label>
              </div>
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
