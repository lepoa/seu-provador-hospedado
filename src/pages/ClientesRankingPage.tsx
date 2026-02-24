import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { endOfDay, endOfMonth, startOfDay, startOfMonth, subDays, subMonths } from "date-fns";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isPaidOrder, type PeriodFilter } from "@/hooks/useDashboardDataV2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

interface RankingRow {
  customerId: string;
  customerName: string;
  receitaPaga: number;
  pedidosPagos: number;
  ticketMedio: number;
  ultimaCompra: string;
  rfvScore: number | null;
}

const PAGE_SIZE = 20;

const periodOptions: Array<{ value: PeriodFilter; label: string }> = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Ultimos 7 dias" },
  { value: "30days", label: "Ultimos 30 dias" },
  { value: "thisMonth", label: "Este mes" },
  { value: "lastMonth", label: "Mes passado" },
  { value: "custom", label: "Personalizado" },
];

const formatCurrency = (value: number) =>
  value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("pt-BR");
}

function getDateRange(period: PeriodFilter, customFrom: string, customTo: string) {
  const now = new Date();

  if (period === "today") {
    return { startDate: startOfDay(now), endDate: endOfDay(now) };
  }
  if (period === "7days") {
    return { startDate: startOfDay(subDays(now, 6)), endDate: endOfDay(now) };
  }
  if (period === "30days") {
    return { startDate: startOfDay(subDays(now, 29)), endDate: endOfDay(now) };
  }
  if (period === "thisMonth") {
    return { startDate: startOfMonth(now), endDate: endOfDay(now) };
  }
  if (period === "lastMonth") {
    const lastMonth = subMonths(now, 1);
    return { startDate: startOfMonth(lastMonth), endDate: endOfMonth(lastMonth) };
  }

  const from = customFrom ? new Date(`${customFrom}T00:00:00`) : startOfDay(now);
  const to = customTo ? new Date(`${customTo}T23:59:59`) : endOfDay(now);
  return {
    startDate: from,
    endDate: to < from ? from : to,
  };
}

export default function ClientesRankingPage() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<PeriodFilter>("30days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { startDate, endDate } = useMemo(
    () => getDateRange(period, customFrom, customTo),
    [period, customFrom, customTo]
  );

  useEffect(() => {
    const loadRanking = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: orders, error: ordersError } = await supabase
          .from("orders")
          .select("id, customer_id, customer_name, total, status, payment_status, created_at")
          .gte("created_at", startDate.toISOString())
          .lte("created_at", endDate.toISOString())
          .order("created_at", { ascending: false })
          .limit(5000);

        if (ordersError) throw ordersError;

        const paidOrders = (orders || []).filter((order) => isPaidOrder(order));
        const map = new Map<string, RankingRow>();

        for (const order of paidOrders) {
          const customerKey = order.customer_id || `anon:${order.customer_name}`;
          const current = map.get(customerKey) || {
            customerId: order.customer_id || customerKey,
            customerName: order.customer_name || "Cliente",
            receitaPaga: 0,
            pedidosPagos: 0,
            ticketMedio: 0,
            ultimaCompra: order.created_at,
            rfvScore: null,
          };

          current.receitaPaga += Number(order.total || 0);
          current.pedidosPagos += 1;
          if (new Date(order.created_at).getTime() > new Date(current.ultimaCompra).getTime()) {
            current.ultimaCompra = order.created_at;
          }

          map.set(customerKey, current);
        }

        const baseRows = Array.from(map.values()).map((item) => ({
          ...item,
          ticketMedio: item.pedidosPagos > 0 ? item.receitaPaga / item.pedidosPagos : 0,
        }));

        const customerIds = baseRows
          .map((item) => item.customerId)
          .filter((id) => id && !id.startsWith("anon:"));

        const rfvMap = new Map<string, number>();
        if (customerIds.length > 0) {
          const { data: rfvRows, error: rfvError } = await supabase
            .from("rfv_daily")
            .select("customer_id, score_recorrencia, day")
            .in("customer_id", customerIds)
            .lte("day", endDate.toISOString().slice(0, 10))
            .order("day", { ascending: false });

          if (!rfvError && rfvRows) {
            for (const row of rfvRows) {
              if (!rfvMap.has(row.customer_id)) {
                rfvMap.set(row.customer_id, Number(row.score_recorrencia || 0));
              }
            }
          }
        }

        const enriched = baseRows
          .map((item) => ({
            ...item,
            rfvScore: rfvMap.get(item.customerId) ?? null,
          }))
          .sort((a, b) => b.receitaPaga - a.receitaPaga);

        setRows(enriched);
        setPage(1);
      } catch (err) {
        console.error("[ClientesRankingPage] load error:", err);
        setError("Nao foi possivel carregar o ranking de clientes.");
        setRows([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadRanking();
  }, [startDate, endDate]);

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pagedRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="container mx-auto max-w-7xl p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ranking de Clientes
          </h1>
          <p className="text-sm text-muted-foreground">Receita paga, recorrencia e atividade por cliente.</p>
        </div>
        <Button variant="outline" onClick={() => navigate("/dashboard?tab=clientes")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {periodOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {period === "custom" && (
            <Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} />
          )}
          {period === "custom" && (
            <Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Carregando ranking...
            </div>
          ) : error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">
              Nenhum cliente com pedidos pagos no periodo selecionado.
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Receita paga</TableHead>
                    <TableHead>Pedidos</TableHead>
                    <TableHead>Ticket medio</TableHead>
                    <TableHead>Ultima compra</TableHead>
                    <TableHead>RFV score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row, index) => (
                    <TableRow
                      key={`${row.customerId}-${index}`}
                      className="cursor-pointer"
                      onClick={() => {
                        if (row.customerId && !row.customerId.startsWith("anon:")) {
                          navigate(`/dashboard/clientes/${row.customerId}`);
                        }
                      }}
                    >
                      <TableCell>{(page - 1) * PAGE_SIZE + index + 1}</TableCell>
                      <TableCell className="font-medium">{row.customerName}</TableCell>
                      <TableCell>{formatCurrency(row.receitaPaga)}</TableCell>
                      <TableCell>{row.pedidosPagos}</TableCell>
                      <TableCell>{formatCurrency(row.ticketMedio)}</TableCell>
                      <TableCell>{formatDate(row.ultimaCompra)}</TableCell>
                      <TableCell>{row.rfvScore !== null ? row.rfvScore.toFixed(1) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  {rows.length} cliente(s) no total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Pagina {page} de {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  >
                    Proxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
