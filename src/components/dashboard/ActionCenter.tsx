import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardFilters } from "@/hooks/useDashboardDataV2";
import { dashboardNavigation } from "@/lib/dashboardNavigation";
import {
  getOperationalPendingOrders,
  type PendingOrder,
  type PendingOrderType,
} from "@/lib/pendingOrdersUtils";

const PAID_STATUSES = new Set([
  "pago",
  "confirmado",
  "preparar_envio",
  "etiqueta_gerada",
  "postado",
  "em_rota",
  "retirada",
  "entregue",
  "enviado",
]);

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

type PendenciasTab = "pagamento_24h" | "sem_logistica_12h" | "sem_vendedora";

export type ActionCenterType = "cancelamento" | "conversao" | "pa" | "pendencias";

interface ActionCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: ActionCenterType;
  filters: DashboardFilters;
  startDate: Date;
  endDate: Date;
}

interface ActionCenterRow {
  order_id: string;
  cliente: string;
  valor: number;
  status: string;
}

const pendenciasTabToType: Record<PendenciasTab, PendingOrderType> = {
  pagamento_24h: "aguardando_pagamento_24h",
  sem_logistica_12h: "pago_sem_logistica",
  sem_vendedora: "sem_vendedora",
};

const pendenciasTabLabel: Record<PendenciasTab, string> = {
  pagamento_24h: "pagamento >24h",
  sem_logistica_12h: "sem logistica >12h",
  sem_vendedora: "sem vendedora",
};

function normalizeActionCenterType(input: string): ActionCenterType {
  const lower = input.toLowerCase();
  if (lower.includes("cancel")) return "cancelamento";
  if (lower.includes("convers")) return "conversao";
  if (lower.includes("peca") || lower === "pa" || lower.includes("atendimento")) return "pa";
  if (lower.includes("pend")) return "pendencias";
  return "conversao";
}

function isPaid(status: string, paymentStatus?: string | null): boolean {
  return PAID_STATUSES.has((status || "").toLowerCase()) || paymentStatus === "approved";
}

function getPiecesByOrder(orderItems: Array<{ quantity: number; product_price: number }> | null | undefined): number {
  if (!orderItems || orderItems.length === 0) return 0;
  return orderItems.reduce((sum, item) => {
    if (Number(item?.product_price || 0) <= 0) return sum;
    return sum + Number(item?.quantity || 0);
  }, 0);
}

export function ActionCenter({
  open,
  onOpenChange,
  type,
  filters,
  startDate,
  endDate,
}: ActionCenterProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<ActionCenterRow[]>([]);
  const [pendingTab, setPendingTab] = useState<PendenciasTab>("pagamento_24h");

  const header = useMemo(() => {
    if (type === "cancelamento") return { title: "Action Center - Cancelamento", desc: "Pedidos cancelados no periodo filtrado." };
    if (type === "pa") return { title: "Action Center - P.A.", desc: "Pedidos pagos com pecas por atendimento abaixo da meta." };
    if (type === "pendencias") return { title: "Action Center - Pendencias", desc: "Fila operacional com prioridade de execucao." };
    return { title: "Action Center - Conversao", desc: "Pedidos ativos que ainda nao converteram em pagamento." };
  }, [type]);

  const targetRoute = useMemo(() => {
    if (type === "cancelamento") return dashboardNavigation.cancelados();
    if (type === "pa") return dashboardNavigation.pagos();
    if (type === "pendencias") {
      if (pendingTab === "pagamento_24h") return dashboardNavigation.aguardandoPagamento24h();
      if (pendingTab === "sem_logistica_12h") return dashboardNavigation.pagoSemLogistica();
      return dashboardNavigation.semVendedora();
    }
    return dashboardNavigation.conversao();
  }, [type, pendingTab]);

  useEffect(() => {
    if (!open) return;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        if (type === "pendencias") {
          const result = await getOperationalPendingOrders({
            startDate,
            endDate,
            liveEventId: filters.liveEventId,
            sellerId: filters.sellerId,
            type: pendenciasTabToType[pendingTab],
          });

          let pendingRows = (result.summary[0]?.orders || []) as PendingOrder[];

          if (filters.channel === "catalog") {
            pendingRows = pendingRows.filter((item) => !item.live_event_id);
          }
          if (filters.channel === "live") {
            pendingRows = pendingRows.filter((item) => !!item.live_event_id || !!item.isLiveCart);
          }

          setRows(
            pendingRows.map((item) => ({
              order_id: item.id,
              cliente: item.customer_name || "Cliente",
              valor: Number(item.total || 0),
              status: item.status || "pendente",
            }))
          );
          return;
        }

        const selectClause =
          type === "pa"
            ? "id, customer_name, total, status, payment_status, created_at, live_event_id, seller_id, order_items(quantity, product_price)"
            : "id, customer_name, total, status, payment_status, created_at, live_event_id, seller_id";

        let query = supabase
          .from("orders")
          .select(selectClause)
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(500);

        if (filters.channel === "catalog") {
          query = query.is("live_event_id", null);
        } else if (filters.channel === "live") {
          query = query.not("live_event_id", "is", null);
        }

        if (filters.liveEventId) {
          query = query.eq("live_event_id", filters.liveEventId);
        }
        if (filters.sellerId) {
          query = query.eq("seller_id", filters.sellerId);
        }

        const { data, error: queryError } = await query;
        if (queryError) throw queryError;

        const list = data || [];
        const filtered = list.filter((item: any) => {
          if (type === "cancelamento") return (item.status || "").toLowerCase() === "cancelado";
          if (type === "conversao") {
            const status = (item.status || "").toLowerCase();
            if (status === "cancelado") return false;
            return !isPaid(status, item.payment_status);
          }
          if (type === "pa") {
            if (!isPaid((item.status || "").toLowerCase(), item.payment_status)) return false;
            const pieces = getPiecesByOrder(item.order_items || []);
            return pieces > 0 && pieces < 1.2;
          }
          return false;
        });

        setRows(
          filtered.map((item: any) => ({
            order_id: item.id,
            cliente: item.customer_name || "Cliente",
            valor: Number(item.total || 0),
            status: item.status || "pendente",
          }))
        );
      } catch (err) {
        console.error("[ActionCenter] load error:", err);
        setError("Nao foi possivel carregar os dados desta acao.");
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [open, type, pendingTab, filters, startDate, endDate]);

  const handleGoToTarget = (orderId?: string) => {
    let route = targetRoute;
    if (orderId) {
      const joiner = route.includes("?") ? "&" : "?";
      route = `${route}${joiner}orderId=${orderId}`;
    }
    onOpenChange(false);
    navigate(route);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="space-y-2">
          <SheetTitle>{header.title}</SheetTitle>
          <SheetDescription>{header.desc}</SheetDescription>
          <div className="pt-1">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => handleGoToTarget()}>
              <ExternalLink className="h-4 w-4" />
              Ir para tela correspondente
            </Button>
          </div>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {type === "pendencias" && (
            <Tabs value={pendingTab} onValueChange={(value) => setPendingTab(value as PendenciasTab)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="pagamento_24h">{pendenciasTabLabel.pagamento_24h}</TabsTrigger>
                <TabsTrigger value="sem_logistica_12h">{pendenciasTabLabel.sem_logistica_12h}</TabsTrigger>
                <TabsTrigger value="sem_vendedora">{pendenciasTabLabel.sem_vendedora}</TabsTrigger>
              </TabsList>
            </Tabs>
          )}

          {isLoading ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando dados...
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              {error}
            </div>
          ) : rows.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Nenhum registro impactado encontrado para os filtros atuais.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>order_id</TableHead>
                  <TableHead>cliente</TableHead>
                  <TableHead>valor</TableHead>
                  <TableHead>status</TableHead>
                  <TableHead className="text-right">acao</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.order_id}>
                    <TableCell className="font-mono text-xs">{row.order_id.slice(0, 8)}...</TableCell>
                    <TableCell>{row.cliente}</TableCell>
                    <TableCell>{formatCurrency(row.valor)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{row.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="secondary" onClick={() => handleGoToTarget(row.order_id)}>
                        Abrir
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function actionCenterTypeFromText(input: string): ActionCenterType {
  return normalizeActionCenterType(input);
}
