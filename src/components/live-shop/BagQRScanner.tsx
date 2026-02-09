import { useState, useEffect, useRef } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription 
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { 
  ScanLine, 
  X, 
  CheckCircle2, 
  AlertTriangle,
  Camera,
  Package,
  Clock,
  History
} from "lucide-react";
import { toast } from "sonner";
import type { SeparationBag } from "@/types/separation";

interface BagQRScannerProps {
  bags: SeparationBag[];
  onMarkBagSeparated: (bagId: string) => Promise<boolean>;
  onMarkItemSeparated: (itemId: string) => Promise<boolean>;
}

interface ScannedBagInfo {
  bagId: string;
  bagNumber: number;
  instagram: string;
  items: number;
  total: number;
}

interface ScanHistoryEntry {
  id: string;
  bagNumber: number;
  instagram: string;
  result: 'success' | 'already_done' | 'not_found';
  timestamp: Date;
  itemsCount?: number;
}

export function BagQRScanner({ 
  bags, 
  onMarkBagSeparated,
  onMarkItemSeparated 
}: BagQRScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<ScannedBagInfo | null>(null);
  const [scanResult, setScanResult] = useState<'success' | 'not_found' | 'already_done' | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scannerContainerId = "qr-scanner-container";

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

  const addToHistory = (entry: Omit<ScanHistoryEntry, 'id' | 'timestamp'>) => {
    const newEntry: ScanHistoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    };
    setScanHistory(prev => [newEntry, ...prev].slice(0, 50)); // Keep last 50 entries
  };

  const onScanSuccess = async (decodedText: string) => {
    try {
      // QR code now contains a URL like /sacola/{bagId}
      // Extract the bag ID from the URL
      let bagId: string | null = null;
      
      // Try to parse as URL path
      const urlMatch = decodedText.match(/\/sacola\/([a-f0-9-]+)/i);
      if (urlMatch) {
        bagId = urlMatch[1];
      } else {
        // Fallback: try to parse as JSON (legacy format)
        try {
          const jsonData = JSON.parse(decodedText);
          bagId = jsonData.bagId;
        } catch {
          // Not JSON either
          bagId = null;
        }
      }
      
      // Find the bag in our list
      const bag = bagId ? bags.find(b => b.id === bagId) : null;
      
      if (!bag) {
        setScanResult('not_found');
        setLastScanned(null);
        addToHistory({
          bagNumber: 0,
          instagram: 'QR Inválido',
          result: 'not_found',
        });
        playSound('error');
        return;
      }

      // Create scanned info from bag
      const scannedInfo: ScannedBagInfo = {
        bagId: bag.id,
        bagNumber: bag.bagNumber,
        instagram: bag.instagramHandle,
        items: bag.totalItems,
        total: bag.totalValue,
      };

      // Check if already separated
      if (bag.status === 'separado') {
        setScanResult('already_done');
        setLastScanned(scannedInfo);
        addToHistory({
          bagNumber: bag.bagNumber,
          instagram: bag.instagramHandle,
          result: 'already_done',
          itemsCount: bag.totalItems,
        });
        playSound('warning');
        return;
      }

      // Mark all unseparated items as separated
      const unseparatedItems = bag.items.filter(
        item => item.status === 'em_separacao'
      );

      let allSuccess = true;
      for (const item of unseparatedItems) {
        const success = await onMarkItemSeparated(item.id);
        if (!success) allSuccess = false;
      }

      if (allSuccess && unseparatedItems.length > 0) {
        setScanResult('success');
        setLastScanned(scannedInfo);
        addToHistory({
          bagNumber: bag.bagNumber,
          instagram: bag.instagramHandle,
          result: 'success',
          itemsCount: unseparatedItems.length,
        });
        playSound('success');
        toast.success(`Sacola #${bag.bagNumber.toString().padStart(3, '0')} marcada como separada!`);
      } else if (unseparatedItems.length === 0) {
        setScanResult('already_done');
        setLastScanned(scannedInfo);
        addToHistory({
          bagNumber: bag.bagNumber,
          instagram: bag.instagramHandle,
          result: 'already_done',
          itemsCount: bag.totalItems,
        });
        playSound('warning');
      }

      // Auto-reset after 2 seconds to allow next scan
      setTimeout(() => {
        setScanResult(null);
        setLastScanned(null);
      }, 2000);

    } catch (err) {
      console.error("Invalid QR code data:", err);
      setScanResult('not_found');
      addToHistory({
        bagNumber: 0,
        instagram: 'QR Inválido',
        result: 'not_found',
      });
      playSound('error');
      
      setTimeout(() => {
        setScanResult(null);
      }, 2000);
    }
  };

  const playSound = (type: 'success' | 'warning' | 'error') => {
    const frequencies = {
      success: [523.25, 659.25, 783.99], // C5, E5, G5 chord
      warning: [440, 440], // A4 repeated
      error: [311.13, 233.08] // Descending
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getResultBadge = (result: ScanHistoryEntry['result']) => {
    switch (result) {
      case 'success':
        return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Separada</Badge>;
      case 'already_done':
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Já feita</Badge>;
      case 'not_found':
        return <Badge variant="destructive" className="text-xs">Não encontrada</Badge>;
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    setScanResult(null);
    setLastScanned(null);
  };

  const handleClose = async () => {
    await stopScanner();
    setIsOpen(false);
    setScanResult(null);
    setLastScanned(null);
  };

  const clearHistory = () => {
    setScanHistory([]);
  };

  useEffect(() => {
    if (isOpen && !isScanning) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        startScanner();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  // Count stats from history
  const sessionStats = {
    success: scanHistory.filter(h => h.result === 'success').length,
    alreadyDone: scanHistory.filter(h => h.result === 'already_done').length,
    notFound: scanHistory.filter(h => h.result === 'not_found').length,
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleOpen}
        className="gap-2"
      >
        <ScanLine className="h-4 w-4" />
        Scanner QR
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Scanner de Sacolas
            </DialogTitle>
            <DialogDescription>
              Aponte a câmera para o QR code da etiqueta da sacola
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            {/* Scanner container */}
            <div 
              id={scannerContainerId} 
              className="w-full aspect-square rounded-lg overflow-hidden bg-muted"
            />

            {/* Overlay for scan result */}
            {scanResult && (
              <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg ${
                scanResult === 'success' 
                  ? 'bg-green-500/90' 
                  : scanResult === 'already_done'
                  ? 'bg-amber-500/90'
                  : 'bg-red-500/90'
              }`}>
                {scanResult === 'success' && (
                  <>
                    <CheckCircle2 className="h-16 w-16 text-white mb-3" />
                    <p className="text-white font-bold text-xl">Separada!</p>
                    {lastScanned && (
                      <p className="text-white/90 text-lg">
                        Sacola #{lastScanned.bagNumber.toString().padStart(3, '0')}
                      </p>
                    )}
                  </>
                )}
                {scanResult === 'already_done' && (
                  <>
                    <Package className="h-16 w-16 text-white mb-3" />
                    <p className="text-white font-bold text-xl">Já Separada</p>
                    {lastScanned && (
                      <p className="text-white/90 text-lg">
                        Sacola #{lastScanned.bagNumber.toString().padStart(3, '0')}
                      </p>
                    )}
                  </>
                )}
                {scanResult === 'not_found' && (
                  <>
                    <AlertTriangle className="h-16 w-16 text-white mb-3" />
                    <p className="text-white font-bold text-xl">Não Encontrada</p>
                    <p className="text-white/90 text-sm">
                      QR code não pertence a esta live
                    </p>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Session Stats */}
          <div className="flex justify-between text-sm pt-2 border-t">
            <div className="flex items-center gap-4">
              <span className="text-green-600 font-medium">
                ✓ {sessionStats.success}
              </span>
              <span className="text-amber-600 font-medium">
                ○ {sessionStats.alreadyDone}
              </span>
              <span className="text-red-600 font-medium">
                ✗ {sessionStats.notFound}
              </span>
            </div>
            <div className="text-muted-foreground">
              Pendentes: {bags.filter(b => b.status !== 'separado' && b.status !== 'cancelado').length}
            </div>
          </div>

          {/* Scan History */}
          {scanHistory.length > 0 && (
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <History className="h-4 w-4" />
                  Histórico de Leituras
                </h4>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearHistory}
                  className="h-7 text-xs text-muted-foreground"
                >
                  Limpar
                </Button>
              </div>
              <ScrollArea className="h-[150px]">
                <div className="space-y-2 pr-3">
                  {scanHistory.map((entry) => (
                    <div 
                      key={entry.id}
                      className={`flex items-center justify-between p-2 rounded-lg text-sm ${
                        entry.result === 'success' 
                          ? 'bg-green-50 border border-green-100' 
                          : entry.result === 'already_done'
                          ? 'bg-amber-50 border border-amber-100'
                          : 'bg-red-50 border border-red-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="font-bold text-base">
                          #{entry.bagNumber.toString().padStart(3, '0')}
                        </div>
                        <div>
                          <div className="font-medium text-primary">
                            {entry.instagram}
                          </div>
                          {entry.itemsCount !== undefined && (
                            <div className="text-xs text-muted-foreground">
                              {entry.itemsCount} {entry.itemsCount === 1 ? 'item' : 'itens'}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getResultBadge(entry.result)}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatTime(entry.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          <Button variant="outline" onClick={handleClose} className="w-full gap-2">
            <X className="h-4 w-4" />
            Fechar Scanner
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
