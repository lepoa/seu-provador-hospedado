import { useState } from "react";
import { Filter, CalendarIcon, X, Check } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  DrawerFooter,
  DrawerClose,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import type { PeriodFilter, ChannelFilter, DashboardFilters } from "@/hooks/useDashboardDataV2";
import { Badge } from "@/components/ui/badge";

interface DashboardMobileFiltersProps {
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
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

export function DashboardMobileFilters({
  filters,
  onFiltersChange,
  sellers,
  liveEvents,
}: DashboardMobileFiltersProps) {
  const [open, setOpen] = useState(false);
  const [localFilters, setLocalFilters] = useState<DashboardFilters>(filters);
  const [showCalendar, setShowCalendar] = useState(false);

  const handleApply = () => {
    onFiltersChange(localFilters);
    setOpen(false);
  };

  const handleReset = () => {
    const resetFilters: DashboardFilters = {
      period: "7days",
      channel: "all",
      liveEventId: null,
      sellerId: null,
    };
    setLocalFilters(resetFilters);
    onFiltersChange(resetFilters);
    setOpen(false);
  };

  // Count active filters
  const activeFilterCount = [
    filters.period !== "7days",
    filters.channel !== "all",
    filters.sellerId !== null,
    filters.liveEventId !== null,
  ].filter(Boolean).length;

  const periodLabel = periodOptions.find(p => p.value === filters.period)?.label || "Período";

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <Filter className="h-4 w-4" />
          <span className="hidden xs:inline">{periodLabel}</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="border-b pb-4">
          <div className="flex items-center justify-between">
            <DrawerTitle>Filtros</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-5 w-5" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>
        
        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* Period Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Período</Label>
            <Select
              value={localFilters.period}
              onValueChange={(v: PeriodFilter) => {
                setLocalFilters({ ...localFilters, period: v });
                if (v === "custom") setShowCalendar(true);
              }}
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range */}
          {localFilters.period === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Intervalo de datas</Label>
              <div className="border rounded-lg p-2">
                <Calendar
                  mode="range"
                  selected={{
                    from: localFilters.customDateRange?.from,
                    to: localFilters.customDateRange?.to,
                  }}
                  onSelect={(range) => {
                    if (range?.from && range?.to) {
                      setLocalFilters({
                        ...localFilters,
                        customDateRange: { from: range.from, to: range.to },
                      });
                    }
                  }}
                  numberOfMonths={1}
                  className="pointer-events-auto"
                />
              </div>
              {localFilters.customDateRange?.from && localFilters.customDateRange?.to && (
                <p className="text-sm text-muted-foreground text-center">
                  {format(localFilters.customDateRange.from, "dd/MM/yyyy", { locale: ptBR })} -{" "}
                  {format(localFilters.customDateRange.to, "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
          )}

          {/* Channel Filter */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Canal</Label>
            <Select
              value={localFilters.channel}
              onValueChange={(v: ChannelFilter) =>
                setLocalFilters({
                  ...localFilters,
                  channel: v,
                  liveEventId: v !== "live" ? null : localFilters.liveEventId,
                })
              }
            >
              <SelectTrigger className="w-full h-12">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {channelOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Live Event Filter */}
          {(localFilters.channel === "all" || localFilters.channel === "live") &&
            liveEvents.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Live</Label>
                <Select
                  value={localFilters.liveEventId || "all_lives"}
                  onValueChange={(v) =>
                    setLocalFilters({
                      ...localFilters,
                      liveEventId: v === "all_lives" ? null : v,
                    })
                  }
                >
                  <SelectTrigger className="w-full h-12">
                    <SelectValue placeholder="Todas as lives" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_lives">Todas as lives</SelectItem>
                    {liveEvents.map((live) => (
                      <SelectItem key={live.id} value={live.id}>
                        {live.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

          {/* Seller Filter */}
          {sellers.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vendedora</Label>
              <Select
                value={localFilters.sellerId || "all_sellers"}
                onValueChange={(v) =>
                  setLocalFilters({
                    ...localFilters,
                    sellerId: v === "all_sellers" ? null : v,
                  })
                }
              >
                <SelectTrigger className="w-full h-12">
                  <SelectValue placeholder="Todas as vendedoras" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all_sellers">Todas as vendedoras</SelectItem>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DrawerFooter className="border-t pt-4 gap-2">
          <Button onClick={handleApply} className="w-full h-12 gap-2">
            <Check className="h-4 w-4" />
            Aplicar Filtros
          </Button>
          <Button variant="outline" onClick={handleReset} className="w-full h-12">
            Limpar Filtros
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
