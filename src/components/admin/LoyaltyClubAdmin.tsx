import { useState } from "react";
import { 
  Settings, Award, Megaphone, Gift, Target, BarChart3, 
  Plus, Pencil, Trash2, Check, X, Loader2, ToggleLeft, ToggleRight
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useLoyaltyAdmin, LoyaltyTier, LoyaltyCampaign, LoyaltyMission } from "@/hooks/useLoyaltyAdmin";
import { ClubRewardsManager } from "./ClubRewardsManager";
import { ClubAutoGiftRulesManager } from "./ClubAutoGiftRulesManager";

export function LoyaltyClubAdmin() {
  const {
    tiers,
    campaigns,
    missions,
    settings,
    messages,
    reportData,
    isLoading,
    saveTier,
    deleteTier,
    saveCampaign,
    deleteCampaign,
    saveMission,
    deleteMission,
    saveSettings,
    saveMessages,
  } = useLoyaltyAdmin();

  const [activeTab, setActiveTab] = useState("config");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-serif">Le.Poá Club</h2>
          <p className="text-sm text-muted-foreground">Programa de fidelidade e gamificação</p>
        </div>
        {settings && (
          <Badge variant={settings.enabled ? "default" : "secondary"} className="gap-1 w-fit">
            {settings.enabled ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
            {settings.enabled ? "Ativo" : "Inativo"}
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Mobile: Horizontal scrollable tabs */}
        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:grid sm:grid-cols-6 sm:w-full bg-muted/50 p-1">
            <TabsTrigger value="config" className="gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[40px]">
              <Settings className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Config</span>
            </TabsTrigger>
            <TabsTrigger value="tiers" className="gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[40px]">
              <Award className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Níveis</span>
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[40px]">
              <Megaphone className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Campanhas</span>
            </TabsTrigger>
            <TabsTrigger value="rewards" className="gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[40px]">
              <Gift className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Recompensas</span>
            </TabsTrigger>
            <TabsTrigger value="missions" className="gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[40px]">
              <Target className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Missões</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="gap-1.5 sm:gap-2 px-3 sm:px-4 min-h-[40px]">
              <BarChart3 className="h-4 w-4" />
              <span className="text-xs sm:text-sm">Relatórios</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Config Tab */}
        <TabsContent value="config" className="space-y-4 sm:space-y-6">
          <ConfigTab settings={settings} messages={messages} onSaveSettings={saveSettings} onSaveMessages={saveMessages} />
        </TabsContent>

        {/* Tiers Tab */}
        <TabsContent value="tiers" className="space-y-4 sm:space-y-6">
          <TiersTab tiers={tiers} onSave={saveTier} onDelete={deleteTier} />
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="space-y-4 sm:space-y-6">
          <CampaignsTab campaigns={campaigns} tiers={tiers} onSave={saveCampaign} onDelete={deleteCampaign} />
        </TabsContent>

        {/* Rewards Tab */}
        <TabsContent value="rewards" className="space-y-4 sm:space-y-6">
          <RewardsTab tiers={tiers} />
        </TabsContent>

        {/* Missions Tab */}
        <TabsContent value="missions" className="space-y-4 sm:space-y-6">
          <MissionsTab missions={missions} tiers={tiers} onSave={saveMission} onDelete={deleteMission} />
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-4 sm:space-y-6">
          <ReportsTab data={reportData} tiers={tiers} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============ CONFIG TAB ============
function ConfigTab({ 
  settings, 
  messages, 
  onSaveSettings, 
  onSaveMessages 
}: { 
  settings: any; 
  messages: any;
  onSaveSettings: (s: any) => Promise<void>;
  onSaveMessages: (m: any) => Promise<void>;
}) {
  const [localSettings, setLocalSettings] = useState(settings);
  const [localMessages, setLocalMessages] = useState(messages);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveSettings(localSettings);
      await onSaveMessages(localMessages);
      toast.success("Configurações salvas!");
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  if (!localSettings) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Regras do programa de pontos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Programa ativo</Label>
            <Switch
              id="enabled"
              checked={localSettings.enabled}
              onCheckedChange={(v) => setLocalSettings({ ...localSettings, enabled: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Pontos por R$ pago</Label>
            <Input
              type="number"
              value={localSettings.pointsPerReal}
              onChange={(e) => setLocalSettings({ ...localSettings, pointsPerReal: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Pontos creditados somente quando o pedido for PAGO
            </p>
          </div>

          <div className="space-y-2">
            <Label>Expiração de pontos (meses)</Label>
            <Input
              type="number"
              value={localSettings.pointsExpiryMonths}
              onChange={(e) => setLocalSettings({ ...localSettings, pointsExpiryMonths: Number(e.target.value) })}
            />
            <p className="text-xs text-muted-foreground">
              Pontos expiram após este período (FIFO)
            </p>
          </div>

          <div className="space-y-2">
            <Label>Limite semanal de missões (pontos)</Label>
            <Input
              type="number"
              value={localSettings.weeklyMissionLimit}
              onChange={(e) => setLocalSettings({ ...localSettings, weeklyMissionLimit: Number(e.target.value) })}
            />
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Regra de estorno:</strong> Se pedido for CANCELADO/ESTORNADO, os pontos são automaticamente removidos.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mensagens do Club</CardTitle>
          <CardDescription>Textos exibidos para os clientes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Boas-vindas</Label>
            <Textarea
              value={localMessages?.welcome || ""}
              onChange={(e) => setLocalMessages({ ...localMessages, welcome: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Subiu de nível</Label>
            <Textarea
              value={localMessages?.levelUp || ""}
              onChange={(e) => setLocalMessages({ ...localMessages, levelUp: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Ganhou pontos (use {"{points}"})</Label>
            <Textarea
              value={localMessages?.pointsEarned || ""}
              onChange={(e) => setLocalMessages({ ...localMessages, pointsEarned: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Pontos expirando (use {"{days}"})</Label>
            <Textarea
              value={localMessages?.pointsExpiring || ""}
              onChange={(e) => setLocalMessages({ ...localMessages, pointsExpiring: e.target.value })}
            />
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2">
        <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}

// ============ TIERS TAB ============
function TiersTab({ 
  tiers, 
  onSave, 
  onDelete 
}: { 
  tiers: LoyaltyTier[]; 
  onSave: (t: Partial<LoyaltyTier>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editingTier, setEditingTier] = useState<Partial<LoyaltyTier> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editingTier?.name || !editingTier?.slug) {
      toast.error("Nome e slug são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await onSave(editingTier);
      setEditingTier(null);
      toast.success("Nível salvo!");
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Níveis do Club</CardTitle>
          <CardDescription>Configure os tiers de fidelidade</CardDescription>
        </div>
        <Button onClick={() => setEditingTier({ isActive: true, multiplier: 1.0, displayOrder: tiers.length })} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Novo Nível
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ordem</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Pontos</TableHead>
              <TableHead>Multiplicador</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tiers.map((tier) => (
              <TableRow key={tier.id}>
                <TableCell>{tier.displayOrder}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: tier.badgeColor }} 
                    />
                    <span className="font-medium">{tier.name}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {tier.minPoints.toLocaleString()} - {tier.maxPoints ? tier.maxPoints.toLocaleString() : "∞"}
                </TableCell>
                <TableCell>{tier.multiplier}x</TableCell>
                <TableCell>
                  <Badge variant={tier.isActive ? "default" : "secondary"}>
                    {tier.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditingTier(tier)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(tier.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={!!editingTier} onOpenChange={(open) => !open && setEditingTier(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTier?.id ? "Editar Nível" : "Novo Nível"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={editingTier?.name || ""}
                  onChange={(e) => setEditingTier({ ...editingTier, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={editingTier?.slug || ""}
                  onChange={(e) => setEditingTier({ ...editingTier, slug: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pontos mínimos</Label>
                <Input
                  type="number"
                  value={editingTier?.minPoints || 0}
                  onChange={(e) => setEditingTier({ ...editingTier, minPoints: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Pontos máximos</Label>
                <Input
                  type="number"
                  value={editingTier?.maxPoints || ""}
                  onChange={(e) => setEditingTier({ ...editingTier, maxPoints: e.target.value ? Number(e.target.value) : null })}
                  placeholder="∞"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Multiplicador</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editingTier?.multiplier || 1}
                  onChange={(e) => setEditingTier({ ...editingTier, multiplier: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cor do badge</Label>
                <Input
                  type="color"
                  value={editingTier?.badgeColor || "#8B7355"}
                  onChange={(e) => setEditingTier({ ...editingTier, badgeColor: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Benefícios</Label>
              <Textarea
                value={editingTier?.benefits || ""}
                onChange={(e) => setEditingTier({ ...editingTier, benefits: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editingTier?.isActive ?? true}
                onCheckedChange={(v) => setEditingTier({ ...editingTier, isActive: v })}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTier(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ CAMPAIGNS TAB ============
function CampaignsTab({ 
  campaigns, 
  tiers,
  onSave, 
  onDelete 
}: { 
  campaigns: LoyaltyCampaign[]; 
  tiers: LoyaltyTier[];
  onSave: (c: Partial<LoyaltyCampaign>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<LoyaltyCampaign> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editing?.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    setSaving(true);
    try {
      await onSave(editing);
      setEditing(null);
      toast.success("Campanha salva!");
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const campaignTypes = [
    { value: "multiplier", label: "Multiplicador de pontos" },
    { value: "bonus_points", label: "Pontos bônus" },
    { value: "auto_gift", label: "Brinde automático" },
    { value: "mission_bonus", label: "Missão bônus" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Campanhas</CardTitle>
          <CardDescription>Promoções e multiplicadores temporários</CardDescription>
        </div>
        <Button onClick={() => setEditing({ isActive: true, campaignType: "multiplier", multiplierValue: 2, channelScope: "both", applicableTiers: ["poa", "classica", "icone", "atelier"], priority: 0 })} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Campanha
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Canal</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Nenhuma campanha cadastrada
                </TableCell>
              </TableRow>
            ) : campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {campaignTypes.find(t => t.value === c.campaignType)?.label || c.campaignType}
                  </Badge>
                </TableCell>
                <TableCell className="capitalize">{c.channelScope}</TableCell>
                <TableCell className="text-sm">
                  {c.startAt ? new Date(c.startAt).toLocaleDateString("pt-BR") : "-"} 
                  {" → "}
                  {c.endAt ? new Date(c.endAt).toLocaleDateString("pt-BR") : "∞"}
                </TableCell>
                <TableCell>
                  <Badge variant={c.isActive ? "default" : "secondary"}>
                    {c.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(c)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(c.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Campanha" : "Nova Campanha"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={editing?.name || ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editing?.description || ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editing?.campaignType || "multiplier"}
                  onValueChange={(v: any) => setEditing({ ...editing, campaignType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {campaignTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Canal</Label>
                <Select
                  value={editing?.channelScope || "both"}
                  onValueChange={(v: any) => setEditing({ ...editing, channelScope: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Ambos</SelectItem>
                    <SelectItem value="live">Só Live</SelectItem>
                    <SelectItem value="catalog">Só Catálogo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {editing?.campaignType === "multiplier" && (
              <div className="space-y-2">
                <Label>Multiplicador</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={editing?.multiplierValue || 2}
                  onChange={(e) => setEditing({ ...editing, multiplierValue: Number(e.target.value) })}
                />
              </div>
            )}
            {editing?.campaignType === "bonus_points" && (
              <div className="space-y-2">
                <Label>Pontos bônus</Label>
                <Input
                  type="number"
                  value={editing?.bonusPoints || 0}
                  onChange={(e) => setEditing({ ...editing, bonusPoints: Number(e.target.value) })}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Início</Label>
                <Input
                  type="datetime-local"
                  value={editing?.startAt?.slice(0, 16) || ""}
                  onChange={(e) => setEditing({ ...editing, startAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
              <div className="space-y-2">
                <Label>Fim</Label>
                <Input
                  type="datetime-local"
                  value={editing?.endAt?.slice(0, 16) || ""}
                  onChange={(e) => setEditing({ ...editing, endAt: e.target.value ? new Date(e.target.value).toISOString() : null })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor mínimo do pedido</Label>
              <Input
                type="number"
                value={editing?.minOrderValue || ""}
                onChange={(e) => setEditing({ ...editing, minOrderValue: e.target.value ? Number(e.target.value) : null })}
                placeholder="Sem mínimo"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editing?.isActive ?? true}
                onCheckedChange={(v) => setEditing({ ...editing, isActive: v })}
              />
              <Label>Campanha ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ REWARDS TAB ============
function RewardsTab({ tiers }: { tiers: LoyaltyTier[] }) {
  const [view, setView] = useState<"menu" | "rewards" | "rules">("menu");

  if (view === "rewards") {
    return <ClubRewardsManager onBack={() => setView("menu")} />;
  }

  if (view === "rules") {
    return <ClubAutoGiftRulesManager onBack={() => setView("menu")} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recompensas & Brindes</CardTitle>
        <CardDescription>
          Gerencie recompensas por resgate de pontos e brindes automáticos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-dashed hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setView("rewards")}>
            <CardContent className="p-6 text-center">
              <Gift className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Resgate por Pontos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Clientes trocam pontos por descontos, frete grátis ou brindes
              </p>
              <Button variant="outline" size="sm">
                Gerenciar Recompensas
              </Button>
            </CardContent>
          </Card>
          <Card className="border-dashed hover:border-primary/50 transition-colors cursor-pointer" onClick={() => setView("rules")}>
            <CardContent className="p-6 text-center">
              <Megaphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
              <h3 className="font-medium mb-1">Brindes Automáticos</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Brindes adicionados automaticamente ao carrinho por regras
              </p>
              <Button variant="outline" size="sm">
                Configurar Regras
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 p-4 bg-muted/50 rounded-lg">
          <h4 className="font-medium mb-2">Níveis e elegibilidade</h4>
          <div className="flex flex-wrap gap-2">
            {tiers.map(tier => (
              <Badge 
                key={tier.id} 
                variant="outline" 
                style={{ borderColor: tier.badgeColor, color: tier.badgeColor }}
              >
                {tier.name} ({tier.minPoints}+ pts)
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ MISSIONS TAB ============
function MissionsTab({ 
  missions, 
  tiers,
  onSave, 
  onDelete 
}: { 
  missions: LoyaltyMission[]; 
  tiers: LoyaltyTier[];
  onSave: (m: Partial<LoyaltyMission>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<Partial<LoyaltyMission> | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!editing?.title || !editing?.missionKey) {
      toast.error("Título e chave são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await onSave(editing);
      setEditing(null);
      toast.success("Missão salva!");
    } catch (error) {
      toast.error("Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const missionTypes = [
    { value: "quiz", label: "Quiz/Perguntas" },
    { value: "profile_update", label: "Atualizar perfil" },
    { value: "photo_upload", label: "Enviar fotos" },
    { value: "first_purchase", label: "Primeira compra" },
    { value: "review", label: "Avaliação" },
  ];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Missões</CardTitle>
          <CardDescription>Questionários e tarefas que dão pontos</CardDescription>
        </div>
        <Button onClick={() => setEditing({ 
          isActive: true, 
          isPublished: false,
          missionType: "quiz", 
          pointsReward: 50, 
          maxPhotos: 5,
          emoji: "🎯",
          displayOrder: missions.length,
          questionsJson: [],
        })} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Missão
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Missão</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Pontos</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {missions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma missão cadastrada
                </TableCell>
              </TableRow>
            ) : missions.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{m.emoji}</span>
                    <div>
                      <div className="font-medium">{m.title}</div>
                      <div className="text-xs text-muted-foreground">{m.subtitle}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {missionTypes.find(t => t.value === m.missionType)?.label || m.missionType}
                  </Badge>
                </TableCell>
                <TableCell>+{m.pointsReward} pts</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Badge variant={m.isActive ? "default" : "secondary"}>
                      {m.isActive ? "Ativo" : "Inativo"}
                    </Badge>
                    {m.isPublished && <Badge variant="outline">Publicado</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Modal */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar Missão" : "Nova Missão"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Emoji</Label>
                <Input
                  value={editing?.emoji || "🎯"}
                  onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                  className="text-center text-xl"
                />
              </div>
              <div className="col-span-3 space-y-2">
                <Label>Título</Label>
                <Input
                  value={editing?.title || ""}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Chave única</Label>
              <Input
                value={editing?.missionKey || ""}
                onChange={(e) => setEditing({ ...editing, missionKey: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                placeholder="ex: mission_trabalho"
              />
            </div>
            <div className="space-y-2">
              <Label>Subtítulo</Label>
              <Input
                value={editing?.subtitle || ""}
                onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={editing?.missionType || "quiz"}
                  onValueChange={(v: any) => setEditing({ ...editing, missionType: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {missionTypes.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Pontos</Label>
                <Input
                  type="number"
                  value={editing?.pointsReward || 50}
                  onChange={(e) => setEditing({ ...editing, pointsReward: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea
                value={editing?.description || ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing?.isActive ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, isActive: v })}
                />
                <Label>Ativo</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={editing?.isPublished ?? false}
                  onCheckedChange={(v) => setEditing({ ...editing, isPublished: v })}
                />
                <Label>Publicado</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ============ REPORTS TAB ============
function ReportsTab({ data, tiers }: { data: any; tiers: LoyaltyTier[] }) {
  if (!data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Carregando relatórios...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pontos Emitidos</div>
            <div className="text-2xl font-bold text-green-600">
              +{data.pointsEarned.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pontos Resgatados</div>
            <div className="text-2xl font-bold text-amber-600">
              -{data.pointsRedeemed.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Pontos Expirados</div>
            <div className="text-2xl font-bold text-red-600">
              {data.pointsExpired.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">Membros Ativos</div>
            <div className="text-2xl font-bold">{data.activeUsers}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Tier Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Nível</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tiers.map(tier => {
                const count = data.tierDistribution.find((t: any) => t.tier === tier.slug)?.count || 0;
                const total = data.activeUsers || 1;
                const percent = Math.round((count / total) * 100);
                
                return (
                  <div key={tier.id} className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: tier.badgeColor }} />
                        {tier.name}
                      </span>
                      <span className="text-muted-foreground">{count} ({percent}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full rounded-full" 
                        style={{ width: `${percent}%`, backgroundColor: tier.badgeColor }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Rewards */}
        <Card>
          <CardHeader>
            <CardTitle>Top Recompensas</CardTitle>
          </CardHeader>
          <CardContent>
            {data.topRewards.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum resgate ainda
              </p>
            ) : (
              <div className="space-y-3">
                {data.topRewards.map((r: any, i: number) => (
                  <div key={i} className="flex justify-between items-center">
                    <span>{r.name}</span>
                    <Badge variant="outline">{r.redemptions} resgates</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
