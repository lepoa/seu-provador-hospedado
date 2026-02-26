import { useEffect, useMemo, useState } from "react";
import { Download, Pencil, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

type MetaRow = {
  id: string;
  name: string;
  internal_code: string | null;
  default_margin: number | null;
  monthly_goal: number | null;
  is_active: boolean;
};

type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  price: number;
  created_at: string;
  stock_by_size: unknown;
};

type PerfRow = {
  qty30: number;
  revenue30: number;
  orderIds30: Set<string>;
  lastSaleAt: string | null;
};

interface ProductCategoriesManagerProps {
  userId: string;
}

const PAID_STATUSES = new Set([
  "pago",
  "preparar_envio",
  "etiqueta_gerada",
  "postado",
  "em_rota",
  "retirada",
  "entregue",
]);

const toDate = (value: string | null) => (value ? new Date(value) : null);
const daysAgo = (value: string | null) =>
  value ? Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000)) : 0;
const money = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v || 0);
const fmtDate = (v: string | null) => (v ? new Date(v).toLocaleDateString("pt-BR") : "-");

const readStock = (stockBySize: unknown): Record<string, number> => {
  if (!stockBySize || typeof stockBySize !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(stockBySize as Record<string, unknown>)) {
    const key = String(k).trim();
    const qty = Number(v ?? 0);
    if (key) out[key] = Number.isFinite(qty) ? Math.max(0, qty) : 0;
  }
  return out;
};

const sumStock = (map: Record<string, number>) => Object.values(map).reduce((a, b) => a + b, 0);
const sizeText = (map: Record<string, number>) => {
  const rows = Object.entries(map).filter(([, qty]) => qty > 0);
  if (rows.length === 0) return "-";
  return rows.map(([size, qty]) => `${size} (${qty})`).join(" | ");
};

export function ProductCategoriesManager({ userId }: ProductCategoriesManagerProps) {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"summary" | "details">("summary");
  const [selectedCategory, setSelectedCategory] = useState("all");

  const [metaRows, setMetaRows] = useState<MetaRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [perfMap, setPerfMap] = useState<Map<string, PerfRow>>(new Map());

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    id: null as string | null,
    originalName: null as string | null,
    name: "",
    internalCode: "",
    margin: "",
    goal: "",
    active: true,
  });

  const load = async () => {
    setLoading(true);
    try {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 30);
      const d365 = new Date();
      d365.setDate(d365.getDate() - 365);

      const [metaRes, productRes, ordersRes] = await Promise.all([
        (supabase.from("categories" as any) as any)
          .select("id,name,internal_code,default_margin,monthly_goal,is_active")
          .eq("user_id", userId),
        supabase
          .from("product_catalog")
          .select("id,name,sku,category,price,created_at,stock_by_size")
          .or(`user_id.eq.${userId},user_id.is.null`),
        supabase
          .from("orders")
          .select("id,created_at,status,payment_status")
          .eq("user_id", userId)
          .gte("created_at", d365.toISOString()),
      ]);

      if (productRes.error) throw productRes.error;
      if (ordersRes.error) throw ordersRes.error;

      const paidOrders = (ordersRes.data || []).filter((o) => PAID_STATUSES.has(o.status) || o.payment_status === "approved");
      const orderIds = paidOrders.map((o) => o.id);
      const orderMap = new Map(paidOrders.map((o) => [o.id, o]));

      const itemRows: Array<{ order_id: string; product_id: string; quantity: number; product_price: number }> = [];
      for (let i = 0; i < orderIds.length; i += 500) {
        const chunk = orderIds.slice(i, i + 500);
        const { data, error } = await supabase
          .from("order_items")
          .select("order_id,product_id,quantity,product_price")
          .in("order_id", chunk);
        if (error) throw error;
        itemRows.push(...(data || []));
      }

      const map = new Map<string, PerfRow>();
      for (const item of itemRows) {
        const order = orderMap.get(item.order_id);
        if (!order) continue;
        const perf = map.get(item.product_id) || { qty30: 0, revenue30: 0, orderIds30: new Set<string>(), lastSaleAt: null };
        const is30 = toDate(order.created_at)! >= d30;
        if (is30) {
          perf.qty30 += Number(item.quantity || 0);
          perf.revenue30 += Number(item.quantity || 0) * Number(item.product_price || 0);
          perf.orderIds30.add(item.order_id);
        }
        if (!perf.lastSaleAt || new Date(perf.lastSaleAt) < new Date(order.created_at)) perf.lastSaleAt = order.created_at;
        map.set(item.product_id, perf);
      }

      setMetaRows((metaRes?.data || []) as MetaRow[]);
      setProducts((productRes.data || []) as ProductRow[]);
      setPerfMap(map);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao carregar categorias");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const summary = useMemo(() => {
    const metaByName = new Map(metaRows.map((m) => [m.name.trim(), m]));
    const byCategory = new Map<string, ProductRow[]>();
    for (const p of products) {
      const cat = (p.category || "Sem categoria").trim() || "Sem categoria";
      byCategory.set(cat, [...(byCategory.get(cat) || []), p]);
    }

    const names = new Set<string>([...Array.from(metaByName.keys()), ...Array.from(byCategory.keys())]);
    const rows = Array.from(names).map((category) => {
      const list = byCategory.get(category) || [];
      const meta = metaByName.get(category);
      const sizeMap: Record<string, number> = {};
      let stock = 0;
      let qty30 = 0;
      let revenue30 = 0;
      const orderIds = new Set<string>();
      let firstDate: string | null = null;
      let lastDate: string | null = null;
      let daysStopped = 0;
      let daysStock = 0;

      for (const p of list) {
        const stockBySize = readStock(p.stock_by_size);
        stock += sumStock(stockBySize);
        for (const [size, qty] of Object.entries(stockBySize)) sizeMap[size] = (sizeMap[size] || 0) + qty;

        if (!firstDate || new Date(p.created_at) < new Date(firstDate)) firstDate = p.created_at;
        if (!lastDate || new Date(p.created_at) > new Date(lastDate)) lastDate = p.created_at;

        const perf = perfMap.get(p.id);
        if (perf) {
          qty30 += perf.qty30;
          revenue30 += perf.revenue30;
          perf.orderIds30.forEach((id) => orderIds.add(id));
        }
        daysStopped += daysAgo(perf?.lastSaleAt || p.created_at);
        daysStock += daysAgo(p.created_at);
      }

      const ticket = orderIds.size > 0 ? revenue30 / orderIds.size : 0;
      return {
        category,
        metaId: meta?.id || null,
        internalCode: meta?.internal_code || null,
        margin: meta?.default_margin ?? null,
        goal: meta?.monthly_goal ?? null,
        active: meta?.is_active ?? true,
        totalProducts: list.length,
        stock,
        giro30: stock > 0 ? qty30 / stock : qty30,
        qty30,
        revenue30,
        ticket,
        firstDate,
        lastDate,
        avgDaysStopped: list.length > 0 ? daysStopped / list.length : 0,
        avgDaysStock: list.length > 0 ? daysStock / list.length : 0,
        sizeMap,
      };
    });

    return rows
      .filter((r) => r.category.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => b.revenue30 - a.revenue30 || b.totalProducts - a.totalProducts);
  }, [metaRows, products, perfMap, search]);

  const detailRows = useMemo(() => {
    return products
      .filter((p) => {
        const cat = (p.category || "Sem categoria").trim() || "Sem categoria";
        return selectedCategory === "all" || cat === selectedCategory;
      })
      .map((p) => {
        const perf = perfMap.get(p.id);
        const stockMap = readStock(p.stock_by_size);
        return {
          ...p,
          stockMap,
          stockTotal: sumStock(stockMap),
          qty30: perf?.qty30 || 0,
          revenue30: perf?.revenue30 || 0,
          daysStopped: daysAgo(perf?.lastSaleAt || p.created_at),
        };
      })
      .sort((a, b) => b.revenue30 - a.revenue30 || b.stockTotal - a.stockTotal);
  }, [products, perfMap, selectedCategory]);

  const categories = useMemo(() => summary.map((s) => s.category), [summary]);

  const openNew = () => {
    setForm({ id: null, originalName: null, name: "", internalCode: "", margin: "", goal: "", active: true });
    setModalOpen(true);
  };

  const openEdit = (row: (typeof summary)[number]) => {
    setForm({
      id: row.metaId,
      originalName: row.category,
      name: row.category,
      internalCode: row.internalCode || "",
      margin: row.margin != null ? String(row.margin) : "",
      goal: row.goal != null ? String(row.goal) : "",
      active: row.active,
    });
    setModalOpen(true);
  };

  const saveCategory = async () => {
    const name = form.name.trim();
    if (!name) return toast.error("Informe o nome da categoria");
    setSaving(true);
    try {
      const payload = {
        name,
        internal_code: form.internalCode.trim() || null,
        default_margin: form.margin.trim() ? Number(form.margin.replace(",", ".")) : null,
        monthly_goal: form.goal.trim() ? Number(form.goal.replace(",", ".")) : null,
        is_active: form.active,
      };
      if (form.id) {
        const { error } = await (supabase.from("categories" as any) as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("categories" as any) as any).insert({ ...payload, user_id: userId });
        if (error) throw error;
      }
      if (form.originalName && form.originalName !== name) {
        const { error } = await supabase.from("product_catalog").update({ category: name }).eq("user_id", userId).eq("category", form.originalName);
        if (error) throw error;
      }
      toast.success("Categoria salva");
      setModalOpen(false);
      await load();
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar categoria");
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = (rows: string[][], filename: string) => {
    const content = rows.map((line) => line.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar categorias..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="gap-2" onClick={() => exportCsv([["categoria", "produtos", "estoque", "giro_30d"], ...summary.map((r) => [r.category, String(r.totalProducts), String(r.stock), r.giro30.toFixed(2)])], `categorias-${new Date().toISOString().slice(0, 10)}.csv`)}>
            <Download className="h-4 w-4" /> Exportar dados
          </Button>
          <Button className="gap-2" onClick={openNew}><Plus className="h-4 w-4" /> Nova Categoria</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "summary" | "details")}>
        <TabsList>
          <TabsTrigger value="summary">Resumo</TabsTrigger>
          <TabsTrigger value="details">Produtos da Categoria</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Produtos</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Giro 30d</TableHead>
                  <TableHead className="text-right">Ticket Medio</TableHead>
                  <TableHead className="text-right">Margem Media</TableHead>
                  <TableHead className="text-right">Primeiro Cadastro</TableHead>
                  <TableHead className="text-right">Ultimo Cadastro</TableHead>
                  <TableHead className="text-right">Tempo Medio Parado</TableHead>
                  <TableHead className="text-right">Tempo Medio em Estoque</TableHead>
                  <TableHead>Numeracao Disponivel</TableHead>
                  <TableHead className="text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summary.map((row) => (
                  <TableRow key={row.category}>
                    <TableCell className="font-medium">{row.category}</TableCell>
                    <TableCell className="text-right">{row.totalProducts}</TableCell>
                    <TableCell className="text-right">{row.stock}</TableCell>
                    <TableCell className="text-right">{row.giro30.toFixed(2)}x</TableCell>
                    <TableCell className="text-right">{money(row.ticket)}</TableCell>
                    <TableCell className="text-right">{row.margin != null ? `${row.margin.toFixed(1)}%` : "-"}</TableCell>
                    <TableCell className="text-right">{fmtDate(row.firstDate)}</TableCell>
                    <TableCell className="text-right">{fmtDate(row.lastDate)}</TableCell>
                    <TableCell className="text-right">{row.avgDaysStopped.toFixed(0)} dias</TableCell>
                    <TableCell className="text-right">{row.avgDaysStock.toFixed(0)} dias</TableCell>
                    <TableCell className="max-w-[260px] text-xs text-muted-foreground">{sizeText(row.sizeMap)}</TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => { setSelectedCategory(row.category); setTab("details"); }}>Ver</Button>
                        <Button size="icon" variant="outline" onClick={() => openEdit(row)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="sm" variant="outline" onClick={() => exportCsv([["produto", "sku", "categoria", "tamanho", "estoque", "preco", "custo", "margem", "data_cadastro", "dias_parado"], ...detailRows.filter((d) => ((d.category || "Sem categoria").trim() || "Sem categoria") === row.category).flatMap((d) => { const entries = Object.entries(d.stockMap); if (!entries.length) return [[d.name, d.sku || "", row.category, "-", "0", String(d.price), "", row.margin != null ? String(row.margin) : "", fmtDate(d.created_at), String(d.daysStopped)]]; return entries.map(([size, qty]) => [d.name, d.sku || "", row.category, size, String(qty), String(d.price), "", row.margin != null ? String(row.margin) : "", fmtDate(d.created_at), String(d.daysStopped)]); })], `categoria-${row.category.toLowerCase().replace(/\s+/g, "-")}.csv`)}>Exportar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!summary.length && <TableRow><TableCell colSpan={12} className="py-12 text-center text-muted-foreground">{loading ? "Carregando..." : "Nenhuma categoria encontrada"}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex w-full max-w-sm items-center gap-2">
              <Label className="min-w-fit">Categoria</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Numeracao</TableHead>
                  <TableHead className="text-right">Estoque</TableHead>
                  <TableHead className="text-right">Preco</TableHead>
                  <TableHead className="text-right">Vendas 30d</TableHead>
                  <TableHead className="text-right">Receita 30d</TableHead>
                  <TableHead className="text-right">Data Cadastro</TableHead>
                  <TableHead className="text-right">Dias Parado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell>{row.sku || "-"}</TableCell>
                    <TableCell className="max-w-[220px] text-xs text-muted-foreground">{sizeText(row.stockMap)}</TableCell>
                    <TableCell className="text-right">{row.stockTotal}</TableCell>
                    <TableCell className="text-right">{money(row.price)}</TableCell>
                    <TableCell className="text-right">{row.qty30}</TableCell>
                    <TableCell className="text-right">{money(row.revenue30)}</TableCell>
                    <TableCell className="text-right">{fmtDate(row.created_at)}</TableCell>
                    <TableCell className="text-right">{row.daysStopped} dias</TableCell>
                  </TableRow>
                ))}
                {!detailRows.length && <TableRow><TableCell colSpan={9} className="py-12 text-center text-muted-foreground">{loading ? "Carregando..." : "Nenhum produto para a categoria selecionada"}</TableCell></TableRow>}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? "Editar categoria" : "Nova categoria"}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2"><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Codigo interno</Label><Input value={form.internalCode} onChange={(e) => setForm((p) => ({ ...p, internalCode: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Margem padrao (%)</Label><Input type="number" value={form.margin} onChange={(e) => setForm((p) => ({ ...p, margin: e.target.value }))} /></div>
            <div className="space-y-2"><Label>Meta mensal</Label><Input type="number" value={form.goal} onChange={(e) => setForm((p) => ({ ...p, goal: e.target.value }))} /></div>
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2"><Label>Ativa</Label><Switch checked={form.active} onCheckedChange={(checked) => setForm((p) => ({ ...p, active: checked }))} /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={saveCategory} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
