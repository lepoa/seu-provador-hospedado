
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  LayoutGrid,
  List,
  Loader2,
  Search,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { CustomerCard, type CustomerManualSegment } from "@/components/crm/CustomerCard";
import { CustomerCatalogModal } from "@/components/crm/CustomerCatalogModal";
import { isCancelledOrder, isPaidOrder } from "@/hooks/useDashboardDataV2";
import { supabase } from "@/integrations/supabase/client";
import { loadExcelJS } from "@/lib/loadExcel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CustomerWithStats {
  id: string;
  phone: string;
  name: string | null;
  email: string | null;
  size: string | null;
  size_letter: string | null;
  size_number: string | null;
  style_title: string | null;
  created_at: string;
  total_orders: number;
  last_order_at: string | null;
  total_spent: number;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  user_id: string | null;
  document: string | null;
}

interface Product {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  images: string[] | null;
  main_image_index: number | null;
  stock_by_size: Record<string, number> | null;
  color: string | null;
  category: string | null;
}

type ViewMode = "cards" | "list";
type QuickFilter = "all" | "incomplete" | "has_orders" | "no_orders" | "has_quiz" | "no_quiz" | "recent";
type RfvFilter = "all" | "high" | "medium" | "low";
type LastPurchaseFilter = "all" | "7" | "30" | "90";
type SortField = "name" | "total_orders" | "total_spent" | "ticket_medio" | "last_order_at" | "rfv_score";
type SortDirection = "asc" | "desc";
type ManualSegmentFilter = "all" | CustomerManualSegment;

type ExportColumnKey =
  | "name"
  | "phone"
  | "email"
  | "orders"
  | "total_spent"
  | "ticket"
  | "last_purchase"
  | "rfv"
  | "segment"
  | "pending"
  | "registration";

interface AdvancedFiltersState {
  lastPurchase: LastPurchaseFilter;
  minTotalSpent: string;
  maxTotalSpent: string;
  rfvLevel: RfvFilter;
  incompleteOnly: boolean;
  pendingOnly: boolean;
  inactiveOnly: boolean;
  manualSegment: ManualSegmentFilter;
}

interface CustomerViewModel extends CustomerWithStats {
  pending_orders: number;
  ticket_medio: number;
  rfv_score: number | null;
  rfv_level: "high" | "medium" | "low" | "none";
  manual_segment: CustomerManualSegment;
  is_complete: boolean;
  is_inactive: boolean;
  days_since_last_purchase: number | null;
}

const STORAGE_KEY = "crm_manual_segments_v1";

const QUICK_FILTERS: Array<{ value: QuickFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "incomplete", label: "Cadastro incompleto" },
  { value: "has_orders", label: "Já compraram" },
  { value: "no_orders", label: "Nunca compraram" },
  { value: "has_quiz", label: "Com quiz" },
  { value: "no_quiz", label: "Sem quiz" },
  { value: "recent", label: "Últimos 7 dias" },
];

const SIZE_OPTIONS = ["_all", "PP", "P", "M", "G", "GG", "34", "36", "38", "40", "42", "44", "46"];

const DEFAULT_ADVANCED: AdvancedFiltersState = {
  lastPurchase: "all",
  minTotalSpent: "",
  maxTotalSpent: "",
  rfvLevel: "all",
  incompleteOnly: false,
  pendingOnly: false,
  inactiveOnly: false,
  manualSegment: "all",
};

const EXPORT_COLUMNS: Array<{ key: ExportColumnKey; label: string }> = [
  { key: "name", label: "Nome" },
  { key: "phone", label: "Telefone" },
  { key: "email", label: "E-mail" },
  { key: "orders", label: "Pedidos" },
  { key: "total_spent", label: "Total gasto" },
  { key: "ticket", label: "Ticket médio" },
  { key: "last_purchase", label: "Última compra" },
  { key: "rfv", label: "RFV" },
  { key: "segment", label: "Segmentação manual" },
  { key: "pending", label: "Pedidos pendentes" },
  { key: "registration", label: "Cadastro completo" },
];

const DEFAULT_EXPORT_COLUMNS: Record<ExportColumnKey, boolean> = {
  name: true,
  phone: true,
  email: true,
  orders: true,
  total_spent: true,
  ticket: true,
  last_purchase: true,
  rfv: true,
  segment: true,
  pending: true,
  registration: false,
};

const SEGMENT_LABELS: Record<CustomerManualSegment, string> = {
  none: "Sem segmento",
  vip: "VIP",
  potencial: "Potencial",
  recuperar: "Recuperar",
  inativo: "Inativo",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("pt-BR");
}

function normalizeText(value: string | null | undefined) {
  return (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function getDaysSince(dateValue: string | null) {
  if (!dateValue) return null;
  return Math.floor((Date.now() - new Date(dateValue).getTime()) / (1000 * 60 * 60 * 24));
}

function getRfvLevel(score: number | null) {
  if (score === null) return "none" as const;
  if (score >= 70) return "high" as const;
  if (score >= 40) return "medium" as const;
  return "low" as const;
}

function readSegments() {
  if (typeof window === "undefined") return {} as Record<string, CustomerManualSegment>;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, CustomerManualSegment>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function isComplete(customer: CustomerWithStats) {
  const values = [
    customer.name,
    customer.phone,
    customer.email,
    customer.size_letter || customer.size_number,
    customer.address_line,
    customer.city,
    customer.zip_code,
  ];
  return values.filter(Boolean).length === values.length;
}

async function loadPendingOrdersMap() {
  const output: Record<string, number> = {};
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("orders")
      .select("customer_id,status,payment_status")
      .not("customer_id", "is", null)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) throw error;

    (data || []).forEach((order) => {
      if (!order.customer_id) return;
      if (isPaidOrder(order) || isCancelledOrder(order)) return;
      output[order.customer_id] = (output[order.customer_id] || 0) + 1;
    });

    if ((data || []).length < pageSize) break;
    from += pageSize;
  }

  return output;
}

function SortHeader({
  field,
  label,
  currentField,
  direction,
  onSort,
}: {
  field: SortField;
  label: string;
  currentField: SortField;
  direction: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = field === currentField;
  return (
    <button type="button" className="inline-flex items-center gap-1" onClick={() => onSort(field)}>
      <span>{label}</span>
      {isActive ? (direction === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground" />}
    </button>
  );
}

export function CustomersManagerV2() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pendingByCustomer, setPendingByCustomer] = useState<Record<string, number>>({});
  const [rfvByCustomer, setRfvByCustomer] = useState<Record<string, number>>({});
  const [manualSegments, setManualSegments] = useState<Record<string, CustomerManualSegment>>(readSegments);
  const [isLoading, setIsLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [styleFilter, setStyleFilter] = useState("_all");
  const [sizeFilter, setSizeFilter] = useState("_all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");

  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFiltersState>(DEFAULT_ADVANCED);
  const [isAdvancedFiltersOpen, setIsAdvancedFiltersOpen] = useState(false);

  const [sortField, setSortField] = useState<SortField>("total_spent");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportScope, setExportScope] = useState<"filtered" | "all">("filtered");
  const [exportColumns, setExportColumns] = useState<Record<ExportColumnKey, boolean>>(DEFAULT_EXPORT_COLUMNS);
  const [isExporting, setIsExporting] = useState(false);

  const [catalogModalOpen, setCatalogModalOpen] = useState(false);
  const [selectedCustomerForCatalog, setSelectedCustomerForCatalog] = useState<CustomerWithStats | null>(null);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manualSegments));
  }, [manualSegments]);

  async function loadData() {
    setIsLoading(true);
    try {
      const [customersRes, productsRes, pendingMap] = await Promise.all([
        supabase.from("customers").select("*").order("last_order_at", { ascending: false, nullsFirst: false }),
        supabase
          .from("product_catalog")
          .select("id,name,price,image_url,images,main_image_index,stock_by_size,color,category")
          .eq("is_active", true),
        loadPendingOrdersMap(),
      ]);

      if (customersRes.error) throw customersRes.error;
      if (productsRes.error) throw productsRes.error;

      const mappedCustomers: CustomerWithStats[] = (customersRes.data || []).map((c) => ({
        id: c.id,
        phone: c.phone,
        name: c.name,
        email: c.email,
        size: c.size,
        size_letter: c.size_letter,
        size_number: c.size_number,
        style_title: c.style_title,
        created_at: c.created_at,
        total_orders: c.total_orders || 0,
        last_order_at: c.last_order_at,
        total_spent: Number(c.total_spent || 0),
        address_line: c.address_line,
        city: c.city,
        state: c.state,
        zip_code: c.zip_code,
        user_id: c.user_id,
        document: c.document,
      }));

      const rfvMap: Record<string, number> = {};
      if (mappedCustomers.length > 0) {
        const { data: latestDayData } = await supabase.from("rfv_daily").select("day").order("day", { ascending: false }).limit(1).maybeSingle();
        if (latestDayData?.day) {
          const customerIds = mappedCustomers.map((customer) => customer.id);
          const chunkSize = 200;
          for (let index = 0; index < customerIds.length; index += chunkSize) {
            const chunk = customerIds.slice(index, index + chunkSize);
            const { data: scoresData, error: scoresError } = await supabase
              .from("rfv_daily")
              .select("customer_id,score_recorrencia")
              .eq("day", latestDayData.day)
              .in("customer_id", chunk);
            if (scoresError) throw scoresError;
            (scoresData || []).forEach((row) => {
              rfvMap[row.customer_id] = Number(row.score_recorrencia || 0);
            });
          }
        }
      }

      setCustomers(mappedCustomers);
      setProducts((productsRes.data || []) as Product[]);
      setPendingByCustomer(pendingMap);
      setRfvByCustomer(rfvMap);
    } catch (error) {
      console.error("[CustomersManagerV2] loadData error", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setIsLoading(false);
    }
  }

  const availableStyles = useMemo(
    () => [...new Set(customers.map((customer) => customer.style_title).filter(Boolean) as string[])],
    [customers]
  );

  const customersWithMeta = useMemo<CustomerViewModel[]>(() => {
    return customers.map((customer) => {
      const ticketMedio = customer.total_orders > 0 ? customer.total_spent / customer.total_orders : 0;
      const daysSince = getDaysSince(customer.last_order_at || customer.created_at);
      const rfvScore = rfvByCustomer[customer.id] ?? null;
      return {
        ...customer,
        pending_orders: pendingByCustomer[customer.id] || 0,
        ticket_medio: ticketMedio,
        rfv_score: rfvScore,
        rfv_level: getRfvLevel(rfvScore),
        manual_segment: manualSegments[customer.id] || "none",
        is_complete: isComplete(customer),
        is_inactive: (daysSince ?? 0) > 30,
        days_since_last_purchase: daysSince,
      };
    });
  }, [customers, manualSegments, pendingByCustomer, rfvByCustomer]);

  const filteredCustomers = useMemo(() => {
    const normalizedSearch = normalizeText(search);
    const minTotalSpent = Number(advancedFilters.minTotalSpent);
    const maxTotalSpent = Number(advancedFilters.maxTotalSpent);
    const hasMin = advancedFilters.minTotalSpent.trim() !== "" && !Number.isNaN(minTotalSpent);
    const hasMax = advancedFilters.maxTotalSpent.trim() !== "" && !Number.isNaN(maxTotalSpent);

    return customersWithMeta.filter((customer) => {
      const matchesSearch =
        normalizedSearch.length === 0 ||
        normalizeText(customer.name).includes(normalizedSearch) ||
        normalizeText(customer.phone).includes(normalizedSearch) ||
        normalizeText(customer.email).includes(normalizedSearch) ||
        normalizeText(customer.style_title).includes(normalizedSearch);
      if (!matchesSearch) return false;

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      switch (quickFilter) {
        case "incomplete":
          if (customer.is_complete) return false;
          break;
        case "has_orders":
          if (customer.total_orders === 0) return false;
          break;
        case "no_orders":
          if (customer.total_orders > 0) return false;
          break;
        case "has_quiz":
          if (!customer.style_title) return false;
          break;
        case "no_quiz":
          if (customer.style_title) return false;
          break;
        case "recent": {
          const referenceDate = customer.last_order_at || customer.created_at;
          if (new Date(referenceDate) < sevenDaysAgo) return false;
          break;
        }
      }

      if (styleFilter !== "_all" && customer.style_title !== styleFilter) return false;
      if (sizeFilter !== "_all") {
        const matchesSize = customer.size_letter?.toLowerCase() === sizeFilter.toLowerCase() || customer.size_number === sizeFilter;
        if (!matchesSize) return false;
      }

      if (advancedFilters.lastPurchase !== "all") {
        const maxDays = Number(advancedFilters.lastPurchase);
        if (customer.days_since_last_purchase === null || customer.days_since_last_purchase > maxDays) return false;
      }
      if (hasMin && customer.total_spent < minTotalSpent) return false;
      if (hasMax && customer.total_spent > maxTotalSpent) return false;
      if (advancedFilters.rfvLevel !== "all" && customer.rfv_level !== advancedFilters.rfvLevel) return false;
      if (advancedFilters.incompleteOnly && customer.is_complete) return false;
      if (advancedFilters.pendingOnly && customer.pending_orders <= 0) return false;
      if (advancedFilters.inactiveOnly && !customer.is_inactive) return false;
      if (advancedFilters.manualSegment !== "all" && customer.manual_segment !== advancedFilters.manualSegment) return false;

      return true;
    });
  }, [advancedFilters, customersWithMeta, quickFilter, search, sizeFilter, styleFilter]);

  const sortedCustomers = useMemo(() => {
    const output = [...filteredCustomers];
    output.sort((a, b) => {
      let value = 0;
      if (sortField === "name") value = (a.name || "Sem nome").localeCompare(b.name || "Sem nome", "pt-BR");
      if (sortField === "total_orders") value = a.total_orders - b.total_orders;
      if (sortField === "total_spent") value = a.total_spent - b.total_spent;
      if (sortField === "ticket_medio") value = a.ticket_medio - b.ticket_medio;
      if (sortField === "last_order_at") value = new Date(a.last_order_at || 0).getTime() - new Date(b.last_order_at || 0).getTime();
      if (sortField === "rfv_score") value = (a.rfv_score ?? -1) - (b.rfv_score ?? -1);
      return sortDirection === "asc" ? value : -value;
    });
    return output;
  }, [filteredCustomers, sortDirection, sortField]);

  const activeAdvancedFilters = useMemo(
    () =>
      [
        advancedFilters.lastPurchase !== "all",
        advancedFilters.minTotalSpent.trim() !== "",
        advancedFilters.maxTotalSpent.trim() !== "",
        advancedFilters.rfvLevel !== "all",
        advancedFilters.incompleteOnly,
        advancedFilters.pendingOnly,
        advancedFilters.inactiveOnly,
        advancedFilters.manualSegment !== "all",
      ].filter(Boolean).length,
    [advancedFilters]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortField(field);
    setSortDirection("desc");
  };

  const handleSegmentChange = (customerId: string, segment: CustomerManualSegment) => {
    setManualSegments((current) => {
      const next = { ...current };
      if (segment === "none") {
        delete next[customerId];
      } else {
        next[customerId] = segment;
      }
      return next;
    });
  };

  const handleExportToggle = (key: ExportColumnKey, checked: boolean) => {
    setExportColumns((current) => ({ ...current, [key]: checked }));
  };

  const openCatalogModal = (customerId: string) => {
    const customer = customers.find((item) => item.id === customerId);
    if (customer) {
      setSelectedCustomerForCatalog(customer);
      setCatalogModalOpen(true);
    }
  };

  const handleExportXlsx = async () => {
    try {
      const selectedColumns = EXPORT_COLUMNS.filter((column) => exportColumns[column.key]);
      if (selectedColumns.length === 0) {
        toast.error("Selecione ao menos uma coluna");
        return;
      }

      const rows = exportScope === "filtered" ? sortedCustomers : customersWithMeta;
      if (rows.length === 0) {
        toast.error("Não há dados para exportar");
        return;
      }

      setIsExporting(true);
      const ExcelJS = await loadExcelJS();
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Clientes CRM");

      const header = sheet.addRow(selectedColumns.map((column) => column.label));
      header.font = { bold: true };

      rows.forEach((customer) => {
        sheet.addRow(
          selectedColumns.map((column) => {
            if (column.key === "name") return customer.name || "Sem nome";
            if (column.key === "phone") return customer.phone;
            if (column.key === "email") return customer.email || "";
            if (column.key === "orders") return customer.total_orders;
            if (column.key === "total_spent") return customer.total_spent;
            if (column.key === "ticket") return customer.ticket_medio;
            if (column.key === "last_purchase") return formatDate(customer.last_order_at);
            if (column.key === "rfv") return customer.rfv_score ?? "";
            if (column.key === "segment") return SEGMENT_LABELS[customer.manual_segment];
            if (column.key === "pending") return customer.pending_orders;
            if (column.key === "registration") return customer.is_complete ? "Completo" : "Incompleto";
            return "";
          })
        );
      });

      sheet.columns.forEach((column, index) => {
        const key = selectedColumns[index]?.key;
        column.width = key === "name" ? 28 : key === "email" ? 30 : 18;
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `clientes-crm-${new Date().toISOString().slice(0, 10)}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("XLSX exportado com sucesso");
      setIsExportModalOpen(false);
    } catch (error) {
      console.error("[CustomersManagerV2] export error", error);
      toast.error("Erro ao exportar XLSX");
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, telefone, e-mail ou estilo..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setIsAdvancedFiltersOpen(true)}>
              <SlidersHorizontal className="h-4 w-4" />
              Filtros avançados
              {activeAdvancedFilters > 0 ? <Badge variant="secondary">{activeAdvancedFilters}</Badge> : null}
            </Button>

            <div className="inline-flex items-center rounded-md border p-1 gap-1 bg-background">
              <Button
                type="button"
                size="sm"
                variant={viewMode === "cards" ? "default" : "ghost"}
                className="gap-1"
                onClick={() => setViewMode("cards")}
              >
                <LayoutGrid className="h-4 w-4" />
                Cards
              </Button>
              <Button
                type="button"
                size="sm"
                variant={viewMode === "list" ? "default" : "ghost"}
                className="gap-1"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
                Lista
              </Button>
            </div>

            <Button className="gap-2" onClick={() => setIsExportModalOpen(true)}>
              <Download className="h-4 w-4" />
              Exportar XLS
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
          <Select value={quickFilter} onValueChange={(value) => setQuickFilter(value as QuickFilter)}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Filtro rápido" />
            </SelectTrigger>
            <SelectContent>
              {QUICK_FILTERS.map((quick) => (
                <SelectItem key={quick.value} value={quick.value}>
                  {quick.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={styleFilter} onValueChange={setStyleFilter}>
            <SelectTrigger className="w-full lg:w-[220px]">
              <SelectValue placeholder="Estilo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os estilos</SelectItem>
              {availableStyles.map((style) => (
                <SelectItem key={style} value={style}>
                  {style}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sizeFilter} onValueChange={setSizeFilter}>
            <SelectTrigger className="w-full lg:w-[180px]">
              <SelectValue placeholder="Tamanho" />
            </SelectTrigger>
            <SelectContent>
              {SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size}>
                  {size === "_all" ? "Todos tamanhos" : size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="h-10 px-3 inline-flex items-center gap-1 whitespace-nowrap">
            <Users className="h-3.5 w-3.5" />
            {sortedCustomers.length} de {customers.length} clientes
          </Badge>
        </div>
      </div>

      {sortedCustomers.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum cliente encontrado com os filtros selecionados.</p>
        </div>
      ) : viewMode === "cards" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCustomers.map((customer) => (
            <CustomerCard
              key={customer.id}
              customer={customer}
              onOpenCatalog={openCatalogModal}
              onManualSegmentChange={handleSegmentChange}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lista de clientes</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead><SortHeader field="name" label="Nome" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortHeader field="total_orders" label="Pedidos" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortHeader field="total_spent" label="Total gasto" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortHeader field="ticket_medio" label="Ticket médio" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortHeader field="last_order_at" label="Última compra" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead><SortHeader field="rfv_score" label="RFV" currentField={sortField} direction={sortDirection} onSort={handleSort} /></TableHead>
                  <TableHead>Segmentação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCustomers.map((customer) => (
                  <TableRow key={customer.id} className="hover:bg-muted/40">
                    <TableCell className="font-medium">
                      <div>
                        <p>{customer.name || "Sem nome"}</p>
                        <p className="text-xs text-muted-foreground">{customer.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>{customer.total_orders}</TableCell>
                    <TableCell>{formatPrice(customer.total_spent)}</TableCell>
                    <TableCell>{formatPrice(customer.ticket_medio)}</TableCell>
                    <TableCell>{formatDate(customer.last_order_at)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <p>{customer.rfv_score !== null ? customer.rfv_score.toFixed(1) : "—"}</p>
                        <p className="text-xs text-muted-foreground">{customer.rfv_level === "high" ? "Alto" : customer.rfv_level === "medium" ? "Médio" : customer.rfv_level === "low" ? "Baixo" : "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{SEGMENT_LABELS[customer.manual_segment]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Sheet open={isAdvancedFiltersOpen} onOpenChange={setIsAdvancedFiltersOpen}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Filtros avançados</SheetTitle>
            <SheetDescription>Ajuste o recorte estratégico do CRM para segmentar clientes com precisão.</SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Período da última compra</Label>
              <Select value={advancedFilters.lastPurchase} onValueChange={(value) => setAdvancedFilters((current) => ({ ...current, lastPurchase: value as LastPurchaseFilter }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="7">Últimos 7 dias</SelectItem>
                  <SelectItem value="30">Últimos 30 dias</SelectItem>
                  <SelectItem value="90">Últimos 90 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Faixa mínima de total gasto</Label>
                <Input type="number" min="0" value={advancedFilters.minTotalSpent} onChange={(event) => setAdvancedFilters((current) => ({ ...current, minTotalSpent: event.target.value }))} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label>Faixa máxima de total gasto</Label>
                <Input type="number" min="0" value={advancedFilters.maxTotalSpent} onChange={(event) => setAdvancedFilters((current) => ({ ...current, maxTotalSpent: event.target.value }))} placeholder="10000" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>RFV</Label>
              <Select value={advancedFilters.rfvLevel} onValueChange={(value) => setAdvancedFilters((current) => ({ ...current, rfvLevel: value as RfvFilter }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="high">Alto</SelectItem>
                  <SelectItem value="medium">Médio</SelectItem>
                  <SelectItem value="low">Baixo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Segmentação manual</Label>
              <Select value={advancedFilters.manualSegment} onValueChange={(value) => setAdvancedFilters((current) => ({ ...current, manualSegment: value as ManualSegmentFilter }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="none">Sem segmento</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="potencial">Potencial</SelectItem>
                  <SelectItem value="recuperar">Recuperar</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Checkbox checked={advancedFilters.incompleteOnly} onCheckedChange={(checked) => setAdvancedFilters((current) => ({ ...current, incompleteOnly: Boolean(checked) }))} id="filter-incomplete" />
                <Label htmlFor="filter-incomplete">Cadastro incompleto</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={advancedFilters.pendingOnly} onCheckedChange={(checked) => setAdvancedFilters((current) => ({ ...current, pendingOnly: Boolean(checked) }))} id="filter-pending" />
                <Label htmlFor="filter-pending">Cliente com pedido pendente</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={advancedFilters.inactiveOnly} onCheckedChange={(checked) => setAdvancedFilters((current) => ({ ...current, inactiveOnly: Boolean(checked) }))} id="filter-inactive" />
                <Label htmlFor="filter-inactive">Cliente inativo (+30 dias sem compra)</Label>
              </div>
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="outline" onClick={() => setAdvancedFilters(DEFAULT_ADVANCED)}>Limpar filtros</Button>
            <Button type="button" onClick={() => setIsAdvancedFiltersOpen(false)}>Aplicar</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Exportar XLS</DialogTitle>
            <DialogDescription>Selecione as colunas e o escopo da exportação. O arquivo será gerado em .xlsx.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Escopo</Label>
              <Select value={exportScope} onValueChange={(value) => setExportScope(value as "filtered" | "all")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="filtered">Exportar filtrados ({sortedCustomers.length})</SelectItem>
                  <SelectItem value="all">Exportar todos ({customersWithMeta.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Colunas</Label>
              <div className="max-h-56 overflow-y-auto rounded-md border p-3 space-y-2">
                {EXPORT_COLUMNS.map((column) => (
                  <div key={column.key} className="flex items-center gap-2">
                    <Checkbox id={`export-${column.key}`} checked={exportColumns[column.key]} onCheckedChange={(checked) => handleExportToggle(column.key, Boolean(checked))} />
                    <Label htmlFor={`export-${column.key}`}>{column.label}</Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsExportModalOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={handleExportXlsx} disabled={isExporting}>
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Gerar XLSX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedCustomerForCatalog && (
        <CustomerCatalogModal
          open={catalogModalOpen}
          onClose={() => {
            setCatalogModalOpen(false);
            setSelectedCustomerForCatalog(null);
          }}
          customerId={selectedCustomerForCatalog.id}
          customerName={selectedCustomerForCatalog.name}
          customerPhone={selectedCustomerForCatalog.phone}
          customerStyle={selectedCustomerForCatalog.style_title}
          customerSizeLetter={selectedCustomerForCatalog.size_letter}
          customerSizeNumber={selectedCustomerForCatalog.size_number}
          availableProducts={products}
        />
      )}
    </div>
  );
}

