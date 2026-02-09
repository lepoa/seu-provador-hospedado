import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ListOrdered,
  Search,
  Download,
  Phone,
  Clock,
  CheckCircle,
  XCircle,
  SkipForward,
  Package,
  AlertTriangle,
  RefreshCw,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { LiveWaitlist, LiveProduct } from "@/types/liveShop";

interface WaitlistTabProps {
  waitlist: LiveWaitlist[];
  products: LiveProduct[];
  onAllocate: (waitlistId: string) => Promise<boolean>;
  onSkip: (waitlistId: string) => Promise<void>;
  onEndQueue: (productId: string, size: string) => Promise<void>;
  getAvailableStock: (productId: string, size: string, totalStock: number) => number;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  'ativa': { label: 'Aguardando', icon: Clock, color: 'bg-amber-100 text-amber-800 border-amber-200' },
  'chamada': { label: 'Chamada', icon: Phone, color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'atendida': { label: 'Atendida', icon: CheckCircle, color: 'bg-green-100 text-green-800 border-green-200' },
  'cancelada': { label: 'Cancelada', icon: XCircle, color: 'bg-muted text-muted-foreground border-muted' },
};

export function WaitlistTab({
  waitlist,
  products,
  onAllocate,
  onSkip,
  onEndQueue,
  getAvailableStock,
}: WaitlistTabProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "ativa" | "atendida" | "cancelada">("all");
  const [productFilter, setProductFilter] = useState<string>("all");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Get full waitlist including all statuses for report
  const allWaitlistEntries = useMemo(() => {
    return waitlist;
  }, [waitlist]);

  // Filter entries
  const filteredEntries = useMemo(() => {
    return allWaitlistEntries.filter(entry => {
      const matchesSearch = !search || 
        entry.instagram_handle.toLowerCase().includes(search.toLowerCase()) ||
        entry.whatsapp?.includes(search);
      
      const matchesStatus = statusFilter === "all" || entry.status === statusFilter;
      
      const matchesProduct = productFilter === "all" || entry.product_id === productFilter;

      return matchesSearch && matchesStatus && matchesProduct;
    });
  }, [allWaitlistEntries, search, statusFilter, productFilter]);

  // Group by product/size for summary
  const groupedSummary = useMemo(() => {
    const groups: Record<string, {
      product: LiveProduct | undefined;
      size: string;
      entries: LiveWaitlist[];
      activeCount: number;
      attendedCount: number;
      cancelledCount: number;
      hasStock: boolean;
      availableStock: number;
    }> = {};

    allWaitlistEntries.forEach(entry => {
      const size = (entry.variante as any)?.tamanho || '';
      const key = `${entry.product_id}_${size}`;
      
      if (!groups[key]) {
        const product = products.find(p => p.product_id === entry.product_id);
        const availableBySize = (product?.product as any)?.available_by_size || {};
        const available = getAvailableStock(entry.product_id, size, availableBySize[size] || 0);
        
        groups[key] = {
          product,
          size,
          entries: [],
          activeCount: 0,
          attendedCount: 0,
          cancelledCount: 0,
          hasStock: available > 0,
          availableStock: available,
        };
      }
      
      groups[key].entries.push(entry);
      
      if (entry.status === 'ativa') groups[key].activeCount++;
      else if (entry.status === 'atendida') groups[key].attendedCount++;
      else if (entry.status === 'cancelada') groups[key].cancelledCount++;
    });

    return Object.values(groups).sort((a, b) => {
      // Prioritize items with stock available and active waitlist
      if (a.hasStock && a.activeCount > 0 && !(b.hasStock && b.activeCount > 0)) return -1;
      if (b.hasStock && b.activeCount > 0 && !(a.hasStock && a.activeCount > 0)) return 1;
      return b.activeCount - a.activeCount;
    });
  }, [allWaitlistEntries, products, getAvailableStock]);

  // KPIs
  const kpis = useMemo(() => {
    const active = allWaitlistEntries.filter(e => e.status === 'ativa').length;
    const attended = allWaitlistEntries.filter(e => e.status === 'atendida').length;
    const cancelled = allWaitlistEntries.filter(e => e.status === 'cancelada').length;
    const withStockAvailable = groupedSummary.filter(g => g.hasStock && g.activeCount > 0).length;
    
    return { active, attended, cancelled, withStockAvailable, total: allWaitlistEntries.length };
  }, [allWaitlistEntries, groupedSummary]);

  // Products with waitlist for filter dropdown
  const productsWithWaitlist = useMemo(() => {
    const productIds = [...new Set(allWaitlistEntries.map(e => e.product_id))];
    return productIds.map(id => products.find(p => p.product_id === id)).filter(Boolean) as LiveProduct[];
  }, [allWaitlistEntries, products]);

  const handleAllocate = async (id: string) => {
    setLoadingId(id);
    await onAllocate(id);
    setLoadingId(null);
  };

  const handleSkip = async (id: string) => {
    setLoadingId(id);
    await onSkip(id);
    setLoadingId(null);
  };

  const getProductInfo = (productId: string) => {
    return products.find(p => p.product_id === productId)?.product;
  };

  // Export to CSV
  const handleExport = () => {
    const headers = ["#", "Instagram", "WhatsApp", "Produto", "Cor", "Tamanho", "Status", "Data/Hora"];
    const rows = filteredEntries.map(entry => {
      const product = getProductInfo(entry.product_id);
      const variante = entry.variante as any;
      return [
        entry.ordem,
        entry.instagram_handle,
        entry.whatsapp || "-",
        product?.name || "-",
        variante?.cor || "-",
        variante?.tamanho || "-",
        statusConfig[entry.status]?.label || entry.status,
        format(new Date(entry.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }),
      ];
    });

    const csvContent = [headers, ...rows].map(row => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `lista-espera-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-gradient-to-br from-amber-50 to-amber-100/50 border-amber-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="text-xs text-amber-700">Aguardando</span>
            </div>
            <div className="text-2xl font-bold text-amber-800">{kpis.active}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 border-green-200">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-xs text-green-700">Atendidas</span>
            </div>
            <div className="text-2xl font-bold text-green-800">{kpis.attended}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-muted to-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Canceladas</span>
            </div>
            <div className="text-2xl font-bold">{kpis.cancelled}</div>
          </CardContent>
        </Card>

        {kpis.withStockAvailable > 0 && (
          <Card className="bg-gradient-to-br from-amber-100 to-orange-100 border-amber-300 animate-pulse col-span-2 md:col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-700" />
                <span className="text-xs font-medium text-amber-800">⚠️ Ação Necessária</span>
              </div>
              <div className="text-lg font-bold text-amber-900">
                {kpis.withStockAvailable} variação(ões) com estoque liberado
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por @ ou WhatsApp..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ativa">Aguardando</SelectItem>
            <SelectItem value="atendida">Atendidas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={productFilter} onValueChange={setProductFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Produto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os produtos</SelectItem>
            {productsWithWaitlist.map(p => (
              <SelectItem key={p.product_id} value={p.product_id}>
                {p.product?.name?.substring(0, 25) || "Produto"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button variant="outline" size="icon" onClick={handleExport}>
          <Download className="h-4 w-4" />
        </Button>
      </div>

      {/* Summary by Product/Size - Alert Section */}
      {groupedSummary.filter(g => g.hasStock && g.activeCount > 0).length > 0 && (
        <Card className="border-amber-300 bg-amber-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              Produtos com estoque liberado e fila ativa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {groupedSummary.filter(g => g.hasStock && g.activeCount > 0).map(group => {
                const firstActive = group.entries.find(e => e.status === 'ativa');
                
                return (
                  <div 
                    key={`${group.product?.product_id}_${group.size}`}
                    className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
                        {group.product?.product?.image_url && (
                          <img
                            src={group.product.product.image_url}
                            alt={group.product.product.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {group.product?.product?.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {group.product?.product?.color && `${group.product.product.color} • `}
                          Tam: {group.size} • {group.availableStock} disponível • {group.activeCount} na fila
                        </div>
                      </div>
                    </div>
                    
                    {firstActive && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-amber-800">
                          {firstActive.instagram_handle}
                        </span>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700"
                          disabled={loadingId === firstActive.id}
                          onClick={() => handleAllocate(firstActive.id)}
                        >
                          <CheckCircle className="h-3 w-3" />
                          Transferir
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListOrdered className="h-4 w-4" />
            Lista Completa ({filteredEntries.length} registros)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tamanho</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-30" />
                      <p>Nenhum registro encontrado</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map(entry => {
                    const product = getProductInfo(entry.product_id);
                    const variante = entry.variante as any;
                    const status = statusConfig[entry.status] || statusConfig.ativa;
                    const StatusIcon = status.icon;
                    const isActive = entry.status === 'ativa';
                    
                    // Check if this entry can be allocated
                    const availableBySize = (products.find(p => p.product_id === entry.product_id)?.product as any)?.available_by_size || {};
                    const availableStock = getAvailableStock(entry.product_id, variante?.tamanho || '', availableBySize[variante?.tamanho] || 0);
                    const canAllocate = isActive && availableStock > 0;

                    return (
                      <TableRow key={entry.id} className={canAllocate ? "bg-amber-50/50" : ""}>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {entry.ordem}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{entry.instagram_handle}</div>
                          {entry.whatsapp && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {entry.whatsapp}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-secondary rounded overflow-hidden shrink-0">
                              {product?.image_url && (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-medium truncate max-w-32">
                                {product?.name || "Produto"}
                              </div>
                              {variante?.cor && (
                                <div className="text-xs text-muted-foreground">
                                  {variante.cor}
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{variante?.tamanho || "-"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={status.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          {isActive && (
                            <div className="flex items-center justify-end gap-1">
                              {canAllocate && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="default"
                                      className="h-7 w-7 bg-green-600 hover:bg-green-700"
                                      disabled={loadingId === entry.id}
                                      onClick={() => handleAllocate(entry.id)}
                                    >
                                      <CheckCircle className="h-3 w-3" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Transferir para carrinho</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    disabled={loadingId === entry.id}
                                    onClick={() => handleSkip(entry.id)}
                                  >
                                    <SkipForward className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Pular (não respondeu)</TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Product Summary */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Package className="h-4 w-4" />
            Resumo por Produto/Tamanho
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {groupedSummary.map(group => (
              <div 
                key={`${group.product?.product_id}_${group.size}`}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  group.hasStock && group.activeCount > 0 
                    ? "border-amber-300 bg-amber-50/50" 
                    : "bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-secondary rounded overflow-hidden shrink-0">
                    {group.product?.product?.image_url && (
                      <img
                        src={group.product.product.image_url}
                        alt={group.product.product.name}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-sm">
                      {group.product?.product?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {group.product?.product?.color && `${group.product.product.color} • `}
                      Tamanho: {group.size}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {group.hasStock && group.activeCount > 0 && (
                    <Badge className="bg-amber-500 text-white animate-pulse text-xs">
                      {group.availableStock} disponível
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {group.activeCount}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-green-700">
                    <CheckCircle className="h-3 w-3 mr-1" />
                    {group.attendedCount}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    <XCircle className="h-3 w-3 mr-1" />
                    {group.cancelledCount}
                  </Badge>
                </div>
              </div>
            ))}
            
            {groupedSummary.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <ListOrdered className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>Nenhum item na lista de espera</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
