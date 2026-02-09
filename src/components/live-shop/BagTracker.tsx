import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import ExcelJS from "exceljs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ScanLine, 
  Camera, 
  X, 
  CheckCircle2, 
  Clock,
  Package,
  Truck,
  MapPin,
  CreditCard,
  AlertTriangle,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  ExternalLink,
  Copy,
  Phone,
  Download,
  FileSpreadsheet,
  MessageCircle,
  Send,
  TrendingUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Trophy,
} from "lucide-react";
import { LivePerformanceRanking } from "./LivePerformanceRanking";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings } from "lucide-react";

interface TrackedBag {
  id: string;
  bagNumber: number;
  instagram: string;
  whatsapp?: string;
  status: string;
  deliveryMethod: string;
  total: number;
  itemsCount: number;
  eventTitle: string;
  eventDate: string;
  createdAt: string;
  mpCheckoutUrl?: string;
}

const STORAGE_KEY = "bag-tracker-bags";
const STORAGE_KEY_THRESHOLD = "bag-tracker-alert-days";
const DEFAULT_ALERT_THRESHOLD_DAYS = 3; // Default threshold

// Helper to calculate days since a date
const getDaysSince = (dateStr: string): number => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};

const getAgeBadge = (days: number, threshold: number) => {
  if (days >= 7) {
    return { label: `${days}d`, color: "bg-red-100 text-red-700 border-red-300", urgent: true };
  } else if (days >= threshold) {
    return { label: `${days}d`, color: "bg-amber-100 text-amber-700 border-amber-300", urgent: true };
  } else if (days >= 1) {
    return { label: `${days}d`, color: "bg-muted text-muted-foreground", urgent: false };
  }
  return { label: "Hoje", color: "bg-muted text-muted-foreground", urgent: false };
};

export function BagTracker() {
  const [isScanning, setIsScanning] = useState(false);
  const [trackedBags, setTrackedBags] = useState<TrackedBag[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [alertThresholdDays, setAlertThresholdDays] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_THRESHOLD);
      return saved ? parseInt(saved, 10) : DEFAULT_ALERT_THRESHOLD_DAYS;
    } catch {
      return DEFAULT_ALERT_THRESHOLD_DAYS;
    }
  });
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "bag-tracker-scanner";

  // Persist threshold to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_THRESHOLD, alertThresholdDays.toString());
  }, [alertThresholdDays]);

  // Persist to localStorage whenever trackedBags changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trackedBags));
  }, [trackedBags]);

  const startScanner = async () => {
    try {
      const html5QrCode = new Html5Qrcode(scannerContainerId);
      scannerRef.current = html5QrCode;

      await html5QrCode.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
        },
        onScanSuccess,
        () => {} // Ignore scan failures
      );
      
      setIsScanning(true);
    } catch (err) {
      console.error("Error starting scanner:", err);
      toast.error("Não foi possível acessar a câmera");
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
        setIsScanning(false);
      } catch (err) {
        console.error("Error stopping scanner:", err);
      }
    }
  };

  const onScanSuccess = async (decodedText: string) => {
    // Extract bag ID from URL or JSON
    let bagId: string | null = null;
    
    const urlMatch = decodedText.match(/\/sacola\/([a-f0-9-]+)/i);
    if (urlMatch) {
      bagId = urlMatch[1];
    } else {
      try {
        const jsonData = JSON.parse(decodedText);
        bagId = jsonData.bagId;
      } catch {
        bagId = null;
      }
    }

    if (!bagId) {
      playSound('error');
      toast.error("QR code inválido");
      return;
    }

    // Check if already tracked
    if (trackedBags.some(b => b.id === bagId)) {
      playSound('warning');
      toast.info("Sacola já adicionada à lista");
      return;
    }

    // Fetch bag details
    await fetchBagDetails(bagId);
  };

  const fetchBagDetails = async (bagId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-live-cart-public', {
        body: { bagId }
      });

      if (error || !data?.bag) {
        playSound('error');
        toast.error("Sacola não encontrada");
        return;
      }

      const bag = data.bag;
      
      // Determine delivery method
      let deliveryMethod = "Não definido";
      if (bag.order_id) {
        // Could fetch order details for delivery method
        deliveryMethod = "Ver pedido";
      }

      const trackedBag: TrackedBag = {
        id: bag.id,
        bagNumber: bag.bag_number || 0,
        instagram: bag.live_customers?.instagram_handle || "Desconhecido",
        whatsapp: bag.live_customers?.whatsapp,
        status: bag.status,
        deliveryMethod,
        total: bag.total || 0,
        itemsCount: data.items?.length || 0,
        eventTitle: bag.live_events?.titulo || "Live",
        eventDate: bag.live_events?.data_hora_inicio || bag.created_at,
        createdAt: bag.created_at,
        mpCheckoutUrl: bag.mp_checkout_url,
      };

      setTrackedBags(prev => [trackedBag, ...prev]);
      playSound('success');
      toast.success(`Sacola #${trackedBag.bagNumber.toString().padStart(3, '0')} adicionada`);
    } catch (err) {
      console.error("Error fetching bag:", err);
      playSound('error');
      toast.error("Erro ao buscar sacola");
    } finally {
      setIsLoading(false);
    }
  };

  const removeBag = (bagId: string) => {
    setTrackedBags(prev => prev.filter(b => b.id !== bagId));
  };

  const clearAllBags = () => {
    setTrackedBags([]);
    toast.success("Lista limpa");
  };

  const refreshBag = async (bagId: string) => {
    const existingIndex = trackedBags.findIndex(b => b.id === bagId);
    if (existingIndex === -1) return;

    try {
      const { data, error } = await supabase.functions.invoke('get-live-cart-public', {
        body: { bagId }
      });

      if (error || !data?.bag) {
        toast.error("Erro ao atualizar");
        return;
      }

      const bag = data.bag;
      const updatedBag: TrackedBag = {
        ...trackedBags[existingIndex],
        status: bag.status,
        total: bag.total || 0,
        itemsCount: data.items?.length || 0,
        mpCheckoutUrl: bag.mp_checkout_url,
      };

      setTrackedBags(prev => {
        const newBags = [...prev];
        newBags[existingIndex] = updatedBag;
        return newBags;
      });

      toast.success("Status atualizado");
    } catch (err) {
      toast.error("Erro ao atualizar");
    }
  };

  const refreshAllBags = async () => {
    for (const bag of trackedBags) {
      await refreshBag(bag.id);
    }
  };

  const copyPaymentLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const openWhatsApp = (phone: string, bag: TrackedBag) => {
    const message = `Olá! Sua sacola #${bag.bagNumber.toString().padStart(3, '0')} da live "${bag.eventTitle}" está aguardando. Total: ${formatCurrency(bag.total)}`;
    const url = `https://wa.me/55${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  // Open bulk WhatsApp messages for all old pending bags
  const openBulkWhatsApp = () => {
    const bagsWithWhatsApp = oldPendingBags.filter(b => b.whatsapp);
    
    if (bagsWithWhatsApp.length === 0) {
      toast.error("Nenhuma sacola pendente tem WhatsApp cadastrado");
      return;
    }

    // Open WhatsApp for each bag sequentially
    let opened = 0;
    bagsWithWhatsApp.forEach((bag, index) => {
      setTimeout(() => {
        const message = `Olá! Sua sacola #${bag.bagNumber.toString().padStart(3, '0')} da live "${bag.eventTitle}" está aguardando pagamento há ${getDaysSince(bag.createdAt)} dias. Total: ${formatCurrency(bag.total)}. Podemos ajudar a finalizar?`;
        const url = `https://wa.me/55${bag.whatsapp!.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
        opened++;
        
        if (opened === bagsWithWhatsApp.length) {
          toast.success(`${opened} conversa(s) aberta(s) no WhatsApp`);
        }
      }, index * 800); // 800ms delay between each to avoid browser blocking
    });
    
    const withoutWhatsApp = oldPendingBags.length - bagsWithWhatsApp.length;
    if (withoutWhatsApp > 0) {
      toast.warning(`${withoutWhatsApp} sacola(s) sem WhatsApp cadastrado`);
    }
  };

  const playSound = (type: 'success' | 'warning' | 'error') => {
    const frequencies = {
      success: [523.25, 659.25, 783.99],
      warning: [440, 440],
      error: [311.13, 233.08]
    };
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const freqs = frequencies[type];
      
      freqs.forEach((freq, index) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = freq;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        
        oscillator.start(audioContext.currentTime + index * 0.1);
        oscillator.stop(audioContext.currentTime + 0.3 + index * 0.1);
      });
    } catch (e) {
      // Audio not supported
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pago': return 'Pago';
      case 'aguardando_pagamento': return 'Aguardando Pagamento';
      case 'cancelado': return 'Cancelado';
      case 'expirado': return 'Expirado';
      default: return status;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pago':
        return <Badge className="bg-green-100 text-green-700 border-green-200 gap-1"><CheckCircle2 className="h-3 w-3" />Pago</Badge>;
      case 'aguardando_pagamento':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 gap-1"><Clock className="h-3 w-3" />Aguardando</Badge>;
      case 'cancelado':
      case 'expirado':
        return <Badge variant="destructive" className="gap-1"><X className="h-3 w-3" />Cancelado</Badge>;
      default:
        return <Badge variant="outline" className="gap-1"><Package className="h-3 w-3" />{status}</Badge>;
    }
  };

  // Export functions
  const exportToCSV = () => {
    if (filteredBags.length === 0) {
      toast.error("Nenhuma sacola para exportar");
      return;
    }

    let csvContent = "";
    
    // Header
    csvContent += `Rastreador de Sacolas - Exportado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}\n\n`;
    
    // Summary
    csvContent += "=== RESUMO ===\n";
    csvContent += `Total de Sacolas;${stats.total}\n`;
    csvContent += `Sacolas Pagas;${stats.paid}\n`;
    csvContent += `Sacolas Pendentes;${stats.pending}\n`;
    csvContent += `Sacolas Canceladas;${stats.cancelled}\n`;
    csvContent += `Valor Total;${formatCurrency(stats.totalValue)}\n`;
    csvContent += `Valor Pago;${formatCurrency(stats.paidValue)}\n\n`;
    
    // Data
    csvContent += "=== SACOLAS ===\n";
    csvContent += "Número;Instagram;Status;Live;Data Live;Itens;Valor;WhatsApp;Link Pagamento\n";
    
    filteredBags.forEach(bag => {
      csvContent += `#${bag.bagNumber.toString().padStart(3, '0')};`;
      csvContent += `@${bag.instagram};`;
      csvContent += `${getStatusLabel(bag.status)};`;
      csvContent += `${bag.eventTitle};`;
      csvContent += `${format(new Date(bag.eventDate), "dd/MM/yyyy", { locale: ptBR })};`;
      csvContent += `${bag.itemsCount};`;
      csvContent += `${formatCurrency(bag.total)};`;
      csvContent += `${bag.whatsapp || "-"};`;
      csvContent += `${bag.mpCheckoutUrl || "-"}\n`;
    });

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rastreador_sacolas_${format(new Date(), "yyyy-MM-dd_HHmm")}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const exportToExcel = async () => {
    if (filteredBags.length === 0) {
      toast.error("Nenhuma sacola para exportar");
      return;
    }

    const wb = new ExcelJS.Workbook();
    
    // Sheet 1: Resumo
    const wsResumo = wb.addWorksheet("Resumo");
    wsResumo.columns = [{ width: 25 }, { width: 20 }];
    [
      ["RASTREADOR DE SACOLAS"],
      [`Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}`],
      [],
      ["INDICADOR", "VALOR"],
      ["Total de Sacolas", stats.total],
      ["Sacolas Pagas", stats.paid],
      ["Sacolas Pendentes", stats.pending],
      ["Sacolas Canceladas", stats.cancelled],
      ["Valor Total", stats.totalValue],
      ["Valor Pago", stats.paidValue],
    ].forEach(row => wsResumo.addRow(row));
    
    // Sheet 2: Sacolas
    const wsSacolas = wb.addWorksheet("Sacolas");
    wsSacolas.columns = [
      { width: 10 }, { width: 20 }, { width: 20 }, { width: 25 },
      { width: 12 }, { width: 8 }, { width: 15 }, { width: 18 }, { width: 50 }
    ];
    wsSacolas.addRow(["NÚMERO", "INSTAGRAM", "STATUS", "LIVE", "DATA LIVE", "ITENS", "VALOR", "WHATSAPP", "LINK PAGAMENTO"]);
    
    filteredBags.forEach(bag => {
      wsSacolas.addRow([
        `#${bag.bagNumber.toString().padStart(3, '0')}`,
        `@${bag.instagram}`,
        getStatusLabel(bag.status),
        bag.eventTitle,
        format(new Date(bag.eventDate), "dd/MM/yyyy", { locale: ptBR }),
        bag.itemsCount,
        bag.total,
        bag.whatsapp || "-",
        bag.mpCheckoutUrl || "-",
      ]);
    });
    
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rastreador_sacolas_${format(new Date(), "yyyy-MM-dd_HHmm")}.xlsx`;
    link.click();
    window.URL.revokeObjectURL(url);
    toast.success("Excel exportado!");
  };

  // Filter and sort bags (pending bags sorted by age, oldest first)
  const filteredBags = trackedBags
    .filter(bag => {
      const matchesSearch = 
        bag.instagram.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bag.bagNumber.toString().includes(searchTerm) ||
        bag.eventTitle.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesFilter = filterStatus === "all" || bag.status === filterStatus;
      
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => {
      // Sort pending bags by age (oldest first)
      if (a.status === 'aguardando_pagamento' && b.status === 'aguardando_pagamento') {
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      // Pending bags come before paid/cancelled
      if (a.status === 'aguardando_pagamento') return -1;
      if (b.status === 'aguardando_pagamento') return 1;
      return 0;
    });

  // Stats with old pending count
  const oldPendingBags = trackedBags.filter(
    b => b.status === 'aguardando_pagamento' && getDaysSince(b.createdAt) >= alertThresholdDays
  );
  
  const stats = {
    total: trackedBags.length,
    paid: trackedBags.filter(b => b.status === 'pago').length,
    pending: trackedBags.filter(b => b.status === 'aguardando_pagamento').length,
    cancelled: trackedBags.filter(b => ['cancelado', 'expirado'].includes(b.status)).length,
    totalValue: trackedBags.reduce((sum, b) => sum + b.total, 0),
    paidValue: trackedBags.filter(b => b.status === 'pago').reduce((sum, b) => sum + b.total, 0),
    oldPending: oldPendingBags.length,
    oldPendingValue: oldPendingBags.reduce((sum, b) => sum + b.total, 0),
  };

  // Conversion rate calculation
  const conversionRate = stats.total > 0 ? (stats.paid / stats.total) * 100 : 0;
  const valueConversionRate = stats.totalValue > 0 ? (stats.paidValue / stats.totalValue) * 100 : 0;

  // Stats by live event
  const statsByLive = trackedBags.reduce((acc, bag) => {
    const key = bag.eventTitle;
    if (!acc[key]) {
      acc[key] = {
        eventTitle: bag.eventTitle,
        eventDate: bag.eventDate,
        total: 0,
        paid: 0,
        pending: 0,
        cancelled: 0,
        totalValue: 0,
        paidValue: 0,
      };
    }
    acc[key].total++;
    acc[key].totalValue += bag.total;
    if (bag.status === 'pago') {
      acc[key].paid++;
      acc[key].paidValue += bag.total;
    } else if (bag.status === 'aguardando_pagamento') {
      acc[key].pending++;
    } else {
      acc[key].cancelled++;
    }
    return acc;
  }, {} as Record<string, { eventTitle: string; eventDate: string; total: number; paid: number; pending: number; cancelled: number; totalValue: number; paidValue: number }>);

  const liveStatsArray = Object.values(statsByLive).sort((a, b) => 
    new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime()
  );

  // State for showing/hiding conversion details
  const [showConversionDetails, setShowConversionDetails] = useState(false);
  const [showRanking, setShowRanking] = useState(false);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Scanner Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Camera className="h-5 w-5 text-primary" />
              Scanner de Sacolas
            </CardTitle>
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <Select
                value={alertThresholdDays.toString()}
                onValueChange={(value) => setAlertThresholdDays(parseInt(value, 10))}
              >
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="Alerta em..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Alerta: 1 dia</SelectItem>
                  <SelectItem value="2">Alerta: 2 dias</SelectItem>
                  <SelectItem value="3">Alerta: 3 dias</SelectItem>
                  <SelectItem value="5">Alerta: 5 dias</SelectItem>
                  <SelectItem value="7">Alerta: 7 dias</SelectItem>
                  <SelectItem value="10">Alerta: 10 dias</SelectItem>
                  <SelectItem value="14">Alerta: 14 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!isScanning ? (
            <Button onClick={startScanner} className="w-full gap-2" size="lg">
              <ScanLine className="h-5 w-5" />
              Iniciar Scanner
            </Button>
          ) : (
            <div className="space-y-4">
              <div 
                id={scannerContainerId} 
                className="w-full max-w-sm mx-auto aspect-square rounded-lg overflow-hidden bg-muted"
              />
              <Button variant="outline" onClick={stopScanner} className="w-full gap-2">
                <X className="h-4 w-4" />
                Parar Scanner
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alert for old pending bags */}
      {stats.oldPending > 0 && (
        <Card className="bg-red-50 border-red-300 border-2 animate-fade-in">
          <CardContent className="py-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-full bg-red-100 p-2 shrink-0">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                </div>
                <div className="flex-1">
                  <h4 className="font-semibold text-red-800">
                    {stats.oldPending} {stats.oldPending === 1 ? 'sacola pendente' : 'sacolas pendentes'} há mais de {alertThresholdDays} dias
                  </h4>
                  <p className="text-sm text-red-700">
                    Valor total pendente: {formatCurrency(stats.oldPendingValue)} — Considere entrar em contato para cobrança
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterStatus('aguardando_pagamento')}
                  className="border-red-300 text-red-700 hover:bg-red-100 gap-1"
                >
                  <Search className="h-3 w-3" />
                  Ver todas
                </Button>
                <Button
                  size="sm"
                  onClick={openBulkWhatsApp}
                  className="bg-[#25D366] hover:bg-[#1EBE5D] text-white gap-1"
                >
                  <MessageCircle className="h-4 w-4" />
                  <Send className="h-3 w-3" />
                  Cobrar todas ({oldPendingBags.filter(b => b.whatsapp).length})
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      {trackedBags.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Sacolas</div>
            </CardContent>
          </Card>
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-green-700">{stats.paid}</div>
              <div className="text-sm text-green-600">Pagas</div>
            </CardContent>
          </Card>
          <Card className={`${stats.oldPending > 0 ? 'bg-red-50 border-red-300' : 'bg-amber-50 border-amber-200'}`}>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${stats.oldPending > 0 ? 'text-red-700' : 'text-amber-700'}`}>
                {stats.pending}
                {stats.oldPending > 0 && (
                  <span className="text-sm font-normal ml-1">({stats.oldPending} antigas)</span>
                )}
              </div>
              <div className={`text-sm ${stats.oldPending > 0 ? 'text-red-600' : 'text-amber-600'}`}>Pendentes</div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-4">
              <div className="text-2xl font-bold text-primary">{formatCurrency(stats.paidValue)}</div>
              <div className="text-sm text-muted-foreground">Valor Pago</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conversion Statistics */}
      {trackedBags.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <button
              onClick={() => setShowConversionDetails(!showConversionDetails)}
              className="flex items-center justify-between w-full text-left"
            >
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-primary" />
                Estatísticas de Conversão
              </CardTitle>
              {showConversionDetails ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CardHeader>
          
          {/* Summary always visible */}
          <CardContent className="pb-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                  <TrendingUp className="h-5 w-5" />
                  {conversionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Taxa de Conversão</div>
                <div className="text-xs text-muted-foreground">({stats.paid}/{stats.total} sacolas)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-green-600">
                  {valueConversionRate.toFixed(1)}%
                </div>
                <div className="text-xs text-muted-foreground">Conversão em Valor</div>
                <div className="text-xs text-muted-foreground">{formatCurrency(stats.paidValue)} de {formatCurrency(stats.totalValue)}</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold">
                  {stats.total > 0 ? formatCurrency(stats.paidValue / stats.paid || 0) : 'R$ 0'}
                </div>
                <div className="text-xs text-muted-foreground">Ticket Médio Pago</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <div className="text-2xl font-bold text-amber-600">
                  {formatCurrency(stats.totalValue - stats.paidValue)}
                </div>
                <div className="text-xs text-muted-foreground">Valor Pendente</div>
              </div>
            </div>
          </CardContent>

          {/* Detailed breakdown by live - collapsible */}
          {showConversionDetails && liveStatsArray.length > 0 && (
            <CardContent className="pt-0">
              <div className="border-t pt-4">
                <h4 className="font-medium text-sm text-muted-foreground mb-3">Conversão por Live</h4>
                <div className="space-y-3">
                  {liveStatsArray.map((liveStat) => {
                    const liveConversion = liveStat.total > 0 ? (liveStat.paid / liveStat.total) * 100 : 0;
                    const liveValueConversion = liveStat.totalValue > 0 ? (liveStat.paidValue / liveStat.totalValue) * 100 : 0;
                    
                    return (
                      <div key={liveStat.eventTitle} className="p-3 rounded-lg border bg-card">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div>
                            <span className="font-medium">{liveStat.eventTitle}</span>
                            <span className="text-xs text-muted-foreground ml-2">
                              {format(new Date(liveStat.eventDate), "dd/MM/yy", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge 
                              variant="outline" 
                              className={`${liveConversion >= 70 ? 'bg-green-100 text-green-700 border-green-300' : liveConversion >= 40 ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-red-100 text-red-700 border-red-300'}`}
                            >
                              <TrendingUp className="h-3 w-3 mr-1" />
                              {liveConversion.toFixed(0)}% conversão
                            </Badge>
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-muted rounded-full h-2 mb-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${liveConversion}%` }}
                          />
                        </div>
                        
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="text-center">
                            <div className="font-semibold">{liveStat.total}</div>
                            <div className="text-muted-foreground">Total</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-green-600">{liveStat.paid}</div>
                            <div className="text-muted-foreground">Pagas</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-amber-600">{liveStat.pending}</div>
                            <div className="text-muted-foreground">Pendentes</div>
                          </div>
                          <div className="text-center">
                            <div className="font-semibold text-primary">{formatCurrency(liveStat.paidValue)}</div>
                            <div className="text-muted-foreground">Pago</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      )}

      {/* Performance Ranking */}
      {trackedBags.length > 0 && liveStatsArray.length >= 2 && (
        <div className="space-y-2">
          <button
            onClick={() => setShowRanking(!showRanking)}
            className="flex items-center gap-2 text-left w-full"
          >
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold">Comparação de Performance</span>
            <Badge variant="secondary" className="ml-2">{liveStatsArray.length} lives</Badge>
            {showRanking ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
            )}
          </button>
          
          {showRanking && (
            <LivePerformanceRanking 
              liveStats={liveStatsArray} 
              formatCurrency={formatCurrency} 
            />
          )}
        </div>
      )}

      {/* Bags List */}
      {trackedBags.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="text-lg">Sacolas Rastreadas ({trackedBags.length})</CardTitle>
              <div className="flex flex-wrap gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Download className="h-4 w-4" />
                      Exportar
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportToCSV} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Exportar CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportToExcel} className="gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Exportar Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="outline" size="sm" onClick={refreshAllBags} className="gap-1">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
                <Button variant="ghost" size="sm" onClick={clearAllBags} className="gap-1 text-destructive">
                  <Trash2 className="h-4 w-4" />
                  Limpar
                </Button>
              </div>
            </div>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-3 pt-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por @instagram, número ou live..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filterStatus} onValueChange={setFilterStatus} className="w-full sm:w-auto">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all" className="text-xs">Todos</TabsTrigger>
                  <TabsTrigger value="pago" className="text-xs">Pagos</TabsTrigger>
                  <TabsTrigger value="aguardando_pagamento" className="text-xs">Pendentes</TabsTrigger>
                  <TabsTrigger value="cancelado" className="text-xs">Cancelados</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-3">
                {filteredBags.map((bag) => {
                  const daysSince = getDaysSince(bag.createdAt);
                  const ageBadge = getAgeBadge(daysSince, alertThresholdDays);
                  const isOldPending = bag.status === 'aguardando_pagamento' && daysSince >= alertThresholdDays;
                  
                  return (
                    <Card 
                      key={bag.id} 
                      className={`border transition-all ${
                        isOldPending 
                          ? 'border-red-300 border-2 bg-red-50/50 shadow-sm' 
                          : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col sm:flex-row justify-between gap-3">
                          {/* Left: Bag Info */}
                          <div className="flex-1 space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xl font-bold">
                                #{bag.bagNumber.toString().padStart(3, '0')}
                              </span>
                              {getStatusBadge(bag.status)}
                              {bag.status === 'aguardando_pagamento' && (
                                <Badge 
                                  variant="outline" 
                                  className={`gap-1 text-xs ${ageBadge.color}`}
                                >
                                  {ageBadge.urgent && <Clock className="h-3 w-3" />}
                                  {ageBadge.label}
                                </Badge>
                              )}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <span className="font-medium text-primary">@{bag.instagram}</span>
                              </div>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Package className="h-3 w-3" />
                                {bag.itemsCount} itens
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {bag.eventTitle}
                              </div>
                              <div className="text-muted-foreground text-xs">
                                {format(new Date(bag.eventDate), "dd/MM/yy", { locale: ptBR })}
                              </div>
                            </div>
                            
                            <div className="text-lg font-semibold text-primary">
                              {formatCurrency(bag.total)}
                            </div>
                          </div>
                        
                        {/* Right: Actions */}
                        <div className="flex flex-row sm:flex-col gap-2 justify-end">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(`/sacola/${bag.id}`, '_blank')}
                            className="gap-1"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Detalhes
                          </Button>
                          
                          {bag.status === 'aguardando_pagamento' && bag.mpCheckoutUrl && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyPaymentLink(bag.mpCheckoutUrl!)}
                              className="gap-1"
                            >
                              <Copy className="h-3 w-3" />
                              Link Pgto
                            </Button>
                          )}
                          
                          {bag.whatsapp && bag.status === 'aguardando_pagamento' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openWhatsApp(bag.whatsapp!, bag)}
                              className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                            >
                              <Phone className="h-3 w-3" />
                              WhatsApp
                            </Button>
                          )}
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => refreshBag(bag.id)}
                            className="gap-1"
                          >
                            <RefreshCw className="h-3 w-3" />
                          </Button>
                          
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeBag(bag.id)}
                            className="gap-1 text-destructive hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}

                {filteredBags.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm || filterStatus !== "all" 
                      ? "Nenhuma sacola encontrada com esses filtros"
                      : "Escaneie QR codes de sacolas para rastreá-las"
                    }
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {trackedBags.length === 0 && !isScanning && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ScanLine className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-2">Nenhuma sacola rastreada</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm">
              Use o scanner para ler QR codes de sacolas de diversas lives e acompanhar o status de pagamento
            </p>
            <Button onClick={startScanner} className="gap-2">
              <Camera className="h-4 w-4" />
              Iniciar Scanner
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
