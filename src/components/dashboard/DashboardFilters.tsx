import { CalendarIcon, Filter } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
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
import { Calendar } from "@/components/ui/calendar";
import type { PeriodFilter, ChannelFilter, DashboardFilters as Filters } from "@/hooks/useDashboardDataV2";
import { cn } from "@/lib/utils";

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  sellers: { id: string; name: string }[];
  liveEvents: { id: string; titulo: string; data_hora_inicio: string }[];
}

const periodOptions: { value: PeriodFilter; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7days", label: "Últimos 7 dias" },
  { value: "30days", label: "Últimos 30 dias" },
  { value: "thisMonth", label: "Este mês" },
  { value: "lastMonth", label: "Mês passado" },
  { value: "custom", label: "Personalizado" },
];

const channelOptions: { value: ChannelFilter; label: string }[] = [
  { value: "all", label: "Todos os canais" },
  { value: "catalog", label: "Catálogo" },
  { value: "live", label: "Live" },
];

export function DashboardFiltersBar({ filters, onFiltersChange, sellers, liveEvents }: DashboardFiltersProps) {
  const handlePeriodChange = (value: PeriodFilter) => {
    onFiltersChange({ ...filters, period: value });
  };

  const handleChannelChange = (value: ChannelFilter) => {
    onFiltersChange({ 
      ...filters, 
      channel: value,
      liveEventId: value !== "live" ? null : filters.liveEventId,
    });
  };

  const handleSellerChange = (value: string) => {
    onFiltersChange({ ...filters, sellerId: value === "all_sellers" ? null : value });
  };

  const handleLiveChange = (value: string) => {
    onFiltersChange({ ...filters, liveEventId: value === "all_lives" ? null : value });
  };

  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    if (range.from && range.to) {
      onFiltersChange({
        ...filters,
        period: "custom",
        customDateRange: { from: range.from, to: range.to },
      });
    }
  };

  return (
    <div className="sticky top-14 sm:top-16 z-40 bg-background/95 backdrop-blur border-b border-border py-2 sm:py-3 -mx-4 px-4 mb-4 sm:mb-6">
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <Filter className="h-4 w-4 text-muted-foreground hidden sm:block" />
        
        {/* Period Filter */}
        <Select value={filters.period} onValueChange={handlePeriodChange}>
          <SelectTrigger className="w-[130px] sm:w-[160px] h-8 sm:h-9 bg-card text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {periodOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Custom Date Range */}
        {filters.period === "custom" && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 h-8 sm:h-9 text-sm">
                <CalendarIcon className="h-4 w-4" />
                {filters.customDateRange ? (
                  <>
                    {format(filters.customDateRange.from, "dd/MM", { locale: ptBR })} - {format(filters.customDateRange.to, "dd/MM", { locale: ptBR })}
                  </>
                ) : (
                  "Selecionar datas"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 bg-popover z-50" align="start">
              <Calendar
                mode="range"
                selected={{
                  from: filters.customDateRange?.from,
                  to: filters.customDateRange?.to,
                }}
                onSelect={(range) => handleDateRangeChange(range || {})}
                numberOfMonths={2}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        )}

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Channel Filter */}
        <Select value={filters.channel} onValueChange={handleChannelChange}>
          <SelectTrigger className="w-[120px] sm:w-[140px] h-8 sm:h-9 bg-card text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            {channelOptions.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Live Filter (when channel includes live) */}
        {(filters.channel === "all" || filters.channel === "live") && liveEvents.length > 0 && (
          <Select 
            value={filters.liveEventId || "all_lives"} 
            onValueChange={handleLiveChange}
          >
            <SelectTrigger className="w-[140px] sm:w-[180px] h-8 sm:h-9 bg-card text-sm">
              <SelectValue placeholder="Todas as lives" />
            </SelectTrigger>
            <SelectContent className="bg-popover z-50">
              <SelectItem value="all_lives">Agrupar por período</SelectItem>
              {liveEvents.map(live => (
                <SelectItem key={live.id} value={live.id}>
                  {live.titulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Seller Filter */}
        <Select 
          value={filters.sellerId || "all_sellers"} 
          onValueChange={handleSellerChange}
        >
          <SelectTrigger className="w-[130px] sm:w-[160px] h-8 sm:h-9 bg-card text-sm">
            <SelectValue placeholder="Vendedoras" />
          </SelectTrigger>
          <SelectContent className="bg-popover z-50">
            <SelectItem value="all_sellers">Todas vendedoras</SelectItem>
            {sellers.map(seller => (
              <SelectItem key={seller.id} value={seller.id}>{seller.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
