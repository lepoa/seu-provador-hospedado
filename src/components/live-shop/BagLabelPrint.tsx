import { useRef } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Printer, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { SeparationBag } from "@/types/separation";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface BagLabelPrintProps {
  bag: SeparationBag;
  eventTitle: string;
  onPrint?: () => void;
  onLabelPrinted?: (bagId: string) => Promise<boolean>;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const generateQRDataUrl = async (data: string): Promise<string> => {
  try {
    return await QRCode.toDataURL(data, {
      width: 150,
      margin: 1,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return '';
  }
};

const getLabelStyles = () => `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: Arial, sans-serif;
    padding: 20px;
    max-width: 300px;
    margin: 0 auto;
  }
  .label {
    border: 2px solid #000;
    border-radius: 8px;
    padding: 16px;
    text-align: center;
    page-break-inside: avoid;
    margin-bottom: 20px;
  }
  .event-title {
    font-size: 10px;
    color: #666;
    margin-bottom: 8px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }
  .bag-number {
    font-size: 48px;
    font-weight: bold;
    margin-bottom: 4px;
  }
  .instagram {
    font-size: 18px;
    font-weight: 600;
    color: #e1306c;
    margin-bottom: 8px;
  }
  .customer-name {
    font-size: 12px;
    color: #666;
    margin-bottom: 8px;
  }
  .qr-container {
    display: flex;
    justify-content: center;
    margin: 12px 0;
  }
  .qr-container img {
    width: 120px;
    height: 120px;
  }
  .details {
    display: flex;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px dashed #ccc;
    margin-top: 8px;
  }
  .detail-item {
    text-align: center;
  }
  .detail-label {
    font-size: 10px;
    color: #666;
    text-transform: uppercase;
  }
  .detail-value {
    font-size: 16px;
    font-weight: bold;
  }
  .items-list {
    text-align: left;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px dashed #ccc;
    font-size: 11px;
  }
  .items-list-title {
    font-weight: bold;
    margin-bottom: 6px;
    font-size: 10px;
    text-transform: uppercase;
    color: #666;
  }
  .item-row {
    display: flex;
    justify-content: space-between;
    padding: 2px 0;
  }
  .item-name {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 180px;
  }
  .item-size {
    font-weight: 600;
    margin-left: 8px;
  }
  .separator {
    border: none;
    border-top: 2px dashed #999;
    margin: 30px 0;
    position: relative;
    page-break-before: always;
  }
  .separator-text {
    text-align: center;
    font-size: 10px;
    color: #666;
    margin-bottom: 10px;
    letter-spacing: 2px;
    text-transform: uppercase;
  }
  @media print {
    body {
      padding: 0;
    }
    .label {
      page-break-after: always;
    }
    .label:last-child {
      page-break-after: avoid;
    }
  }
`;

const generateLabelHtml = (bag: SeparationBag, eventTitle: string, qrDataUrl: string) => {
  return `
    <div class="label">
      <div class="event-title">${eventTitle}</div>
      <div class="bag-number">#${bag.bagNumber.toString().padStart(3, '0')}</div>
      <div class="instagram">${bag.instagramHandle}</div>
      ${bag.customerName ? `<div class="customer-name">${bag.customerName}</div>` : ''}
      
      <div class="qr-container">
        <img src="${qrDataUrl}" alt="QR Code" />
      </div>
      
      <div class="details">
        <div class="detail-item">
          <div class="detail-label">Itens</div>
          <div class="detail-value">${bag.totalItems}</div>
        </div>
        <div class="detail-item">
          <div class="detail-label">Total</div>
          <div class="detail-value">${formatCurrency(bag.totalValue)}</div>
        </div>
      </div>
      
      ${bag.items.length > 0 ? `
        <div class="items-list">
          <div class="items-list-title">Itens da Sacola</div>
          ${bag.items.map(item => `
            <div class="item-row">
              <span class="item-name">${item.quantity}x ${item.productName}${item.color ? ` - ${item.color}` : ''}</span>
              <span class="item-size">${item.size || ''}</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;
};

export function BagLabelPrint({ bag, eventTitle, onPrint, onLabelPrinted }: BagLabelPrintProps) {
  const handlePrint = async () => {
    // Generate QR code with URL to bag details page
    const bagUrl = `${window.location.origin}/sacola/${bag.id}`;

    // Generate QR code as data URL
    const qrDataUrl = await generateQRDataUrl(bagUrl);
    
    if (!qrDataUrl) {
      toast.error("Erro ao gerar QR code");
      return;
    }

    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (!printWindow) {
      toast.error("Não foi possível abrir janela de impressão");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiqueta Sacola #${bag.bagNumber.toString().padStart(3, '0')}</title>
          <style>${getLabelStyles()}</style>
        </head>
        <body>
          ${generateLabelHtml(bag, eventTitle, qrDataUrl)}
          <script>
            // Wait for image to load before printing
            const img = document.querySelector('.qr-container img');
            if (img.complete) {
              setTimeout(() => { window.print(); window.close(); }, 300);
            } else {
              img.onload = () => { setTimeout(() => { window.print(); window.close(); }, 300); };
            }
          <\/script>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Mark label as printed
    if (onLabelPrinted) {
      await onLabelPrinted(bag.id);
    }
    
    onPrint?.();
  };

  // Determine button state based on label_printed_at and needs_label_reprint
  const hasBeenPrinted = !!bag.labelPrintedAt;
  const needsReprint = bag.needsReprintLabel;
  
  // Format print time if available
  const printTimeLabel = bag.labelPrintedAt 
    ? format(new Date(bag.labelPrintedAt), "HH:mm")
    : null;

  return (
    <TooltipProvider>
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {/* Show "Alterada" badge if needs reprint - now orange */}
        {needsReprint && (
          <Badge className="text-xs bg-orange-500 hover:bg-orange-600 text-white border-transparent">
            Alterada
          </Badge>
        )}
        
        {/* Show print time if printed */}
        {hasBeenPrinted && (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Impressa {printTimeLabel}{needsReprint ? ' • Alterada' : ''}
          </span>
        )}
        
        {needsReprint ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size="sm"
                className="h-8 gap-1"
                onClick={handlePrint}
              >
                <Tag className="h-4 w-4" />
                <span className="hidden sm:inline">Gerar etiqueta</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Houve alteração após impressão. Gere a etiqueta novamente.</p>
            </TooltipContent>
          </Tooltip>
        ) : hasBeenPrinted ? (
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            <span className="hidden sm:inline">Imprimir novamente</span>
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="h-8 gap-1"
            onClick={handlePrint}
          >
            <Tag className="h-4 w-4" />
            <span className="hidden sm:inline">Gerar etiqueta</span>
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}

// Component for batch printing multiple labels
interface BatchLabelPrintProps {
  bags: SeparationBag[];
  eventTitle: string;
  onLabelsAsPrinted?: (bagIds: string[]) => Promise<boolean>;
}

export function BatchLabelPrint({ bags, eventTitle, onLabelsAsPrinted }: BatchLabelPrintProps) {
  const handleBatchPrint = async () => {
    if (bags.length === 0) return;

    const baseUrl = window.location.origin;

    // Generate all QR codes first
    const labelsWithQR = await Promise.all(
      bags.map(async (bag) => {
        const bagUrl = `${baseUrl}/sacola/${bag.id}`;
        const qrDataUrl = await generateQRDataUrl(bagUrl);
        return { bag, qrDataUrl };
      })
    );

    const printWindow = window.open('', '_blank', 'width=400,height=800');
    if (!printWindow) {
      toast.error("Não foi possível abrir janela de impressão");
      return;
    }

    // Generate labels with separators between them
    const labelsHtml = labelsWithQR
      .map(({ bag, qrDataUrl }, index) => {
        const labelHtml = generateLabelHtml(bag, eventTitle, qrDataUrl);
        // Add separator before each label except the first
        if (index > 0) {
          return `
            <div class="separator-text">✂ CORTE AQUI ✂</div>
            <hr class="separator" />
            ${labelHtml}
          `;
        }
        return labelHtml;
      })
      .join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Etiquetas - ${eventTitle}</title>
          <style>${getLabelStyles()}</style>
        </head>
        <body>
          ${labelsHtml}
          <script>
            // Wait for all images to load before printing
            const images = document.querySelectorAll('.qr-container img');
            let loaded = 0;
            const total = images.length;
            
            function checkPrint() {
              loaded++;
              if (loaded >= total) {
                setTimeout(() => { window.print(); window.close(); }, 500);
              }
            }
            
            images.forEach(img => {
              if (img.complete) {
                checkPrint();
              } else {
                img.onload = checkPrint;
                img.onerror = checkPrint;
              }
            });
            
            // Fallback timeout
            setTimeout(() => { window.print(); window.close(); }, 3000);
          <\/script>
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Mark all labels as printed
    if (onLabelsAsPrinted) {
      const bagIds = bags.map(b => b.id);
      await onLabelsAsPrinted(bagIds);
    }
  };

  // Count bags that need reprinting
  const needsReprintCount = bags.filter(b => b.needsReprintLabel).length;
  const neverPrintedCount = bags.filter(b => !b.labelPrintedAt).length;

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleBatchPrint}
      disabled={bags.length === 0}
    >
      <Printer className="h-4 w-4" />
      Imprimir Todas ({bags.length})
      {needsReprintCount > 0 && (
        <Badge variant="destructive" className="ml-1 text-xs">
          {needsReprintCount} alterada{needsReprintCount > 1 ? 's' : ''}
        </Badge>
      )}
      {neverPrintedCount > 0 && needsReprintCount === 0 && (
        <Badge variant="secondary" className="ml-1 text-xs">
          {neverPrintedCount} nova{neverPrintedCount > 1 ? 's' : ''}
        </Badge>
      )}
    </Button>
  );
}
