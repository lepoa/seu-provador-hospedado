import { Button } from "@/components/ui/button";
import { FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import logoLepoa from "@/assets/logo-lepoa.png";

interface OrderItem {
  id: string;
  product_name: string;
  product_price: number;
  size: string;
  quantity: number;
  color: string | null;
  image_url: string | null;
  product_sku: string | null;
}

interface Order {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  delivery_method: string | null;
  internal_notes: string | null;
  customer_notes: string | null;
  delivery_period: string | null;
}

interface OrderPackingSlipPrintProps {
  order: Order;
  items: OrderItem[];
  variant?: "button" | "icon";
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const getDeliveryLabel = (method: string | null) => {
  switch (method) {
    case "motoboy": return "Motoboy";
    case "pickup": return "Retirada na loja";
    case "shipping": return "Correios";
    default: return "Não definido";
  }
};

const getPackingSlipStyles = () => `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    padding: 20px;
    max-width: 800px;
    margin: 0 auto;
    font-size: 12px;
    color: #1a1a1a;
  }
  .packing-slip {
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 24px;
    page-break-inside: avoid;
    margin-bottom: 20px;
  }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #000;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }
  .logo-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-section img {
    height: 40px;
    object-fit: contain;
  }
  .store-name {
    font-size: 24px;
    font-weight: bold;
  }
  .document-title {
    font-size: 18px;
    font-weight: bold;
    text-transform: uppercase;
    color: #666;
  }
  .order-info {
    text-align: right;
  }
  .order-number {
    font-size: 20px;
    font-weight: bold;
    font-family: monospace;
  }
  .order-date {
    font-size: 11px;
    color: #666;
  }
  .section {
    margin-bottom: 16px;
  }
  .section-title {
    font-size: 11px;
    font-weight: bold;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 8px;
    border-bottom: 1px solid #eee;
    padding-bottom: 4px;
  }
  .customer-info {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .info-block {
    padding: 12px;
    background: #f9f9f9;
    border-radius: 6px;
  }
  .info-label {
    font-size: 10px;
    color: #666;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .info-value {
    font-size: 13px;
    font-weight: 500;
  }
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  .items-table th {
    background: #f3f3f3;
    padding: 10px 8px;
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    font-weight: 600;
    border-bottom: 2px solid #ddd;
  }
  .items-table td {
    padding: 12px 8px;
    border-bottom: 1px solid #eee;
    vertical-align: top;
  }
  .items-table tr:last-child td {
    border-bottom: none;
  }
  .item-name {
    font-weight: 500;
    font-size: 13px;
  }
  .item-sku {
    font-size: 11px;
    color: #444;
    font-family: monospace;
    margin-top: 2px;
  }
  .item-details {
    font-size: 11px;
    color: #666;
    margin-top: 2px;
  }
  .item-photo-col {
    width: 50px;
    text-align: center;
    vertical-align: middle;
  }
  .item-thumbnail {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #ddd;
  }
  .no-photo {
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #f5f5f5;
    border-radius: 4px;
    font-size: 16px;
    margin: 0 auto;
  }
  .item-size {
    font-weight: 600;
    font-size: 14px;
    text-align: center;
  }
  .item-qty {
    font-weight: 600;
    font-size: 14px;
    text-align: center;
  }
  .item-price {
    text-align: right;
    font-weight: 500;
  }
  .checkbox-col {
    width: 30px;
    text-align: center;
  }
  .checkbox {
    width: 16px;
    height: 16px;
    border: 2px solid #000;
    display: inline-block;
    border-radius: 3px;
  }
  .totals {
    display: flex;
    justify-content: flex-end;
  }
  .totals-box {
    text-align: right;
    background: #f9f9f9;
    padding: 12px 16px;
    border-radius: 6px;
    min-width: 200px;
  }
  .total-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 12px;
  }
  .total-row.grand-total {
    font-size: 16px;
    font-weight: bold;
    border-top: 2px solid #000;
    margin-top: 8px;
    padding-top: 8px;
  }
  .notes-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-top: 16px;
  }
  .notes-box {
    padding: 12px;
    border: 1px dashed #ccc;
    border-radius: 6px;
    min-height: 60px;
  }
  .notes-title {
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
    color: #666;
    margin-bottom: 6px;
  }
  .notes-content {
    font-size: 11px;
    white-space: pre-wrap;
  }
  .signature-section {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
    margin-top: 24px;
    padding-top: 16px;
    border-top: 2px dashed #ccc;
  }
  .signature-box {
    text-align: center;
  }
  .signature-line {
    border-bottom: 1px solid #000;
    height: 40px;
    margin-bottom: 8px;
  }
  .signature-label {
    font-size: 11px;
    color: #666;
  }
  .delivery-badge {
    display: inline-block;
    padding: 4px 12px;
    background: #e0f2fe;
    color: #0369a1;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
  }
  .delivery-badge.motoboy {
    background: #fef3c7;
    color: #92400e;
  }
  .delivery-badge.pickup {
    background: #d1fae5;
    color: #065f46;
  }
  @media print {
    body {
      padding: 0;
    }
    .packing-slip {
      border: none;
      page-break-after: always;
    }
    .packing-slip:last-child {
      page-break-after: avoid;
    }
  }
`;

const generatePackingSlipHtml = (order: Order, items: OrderItem[], logoDataUrl?: string) => {
  const orderNumber = order.id.slice(0, 8).toUpperCase();
  const orderDate = format(new Date(order.created_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  const deliveryClass = order.delivery_method === 'motoboy' ? 'motoboy' : order.delivery_method === 'pickup' ? 'pickup' : '';
  
  const itemsHtml = items.map(item => `
    <tr>
      <td class="checkbox-col"><span class="checkbox"></span></td>
      <td class="item-photo-col">
        ${item.image_url ? `<img src="${item.image_url}" alt="${item.product_name}" class="item-thumbnail" />` : '<div class="no-photo">📷</div>'}
      </td>
      <td>
        <div class="item-name">${item.product_name}</div>
        ${item.product_sku ? `<div class="item-sku">SKU: ${item.product_sku}</div>` : ''}
        ${item.color ? `<div class="item-details">Cor: ${item.color}</div>` : ''}
      </td>
      <td class="item-size">${item.size || '-'}</td>
      <td class="item-qty">${item.quantity}</td>
      <td class="item-price">${formatCurrency(item.product_price * item.quantity)}</td>
    </tr>
  `).join('');

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  return `
    <div class="packing-slip">
      <div class="header">
        <div class="logo-section">
          ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo" />` : ''}
          <div>
            <div class="document-title">Romaneio de Separação</div>
          </div>
        </div>
        <div class="order-info">
          <div class="order-number">#${orderNumber}</div>
          <div class="order-date">${orderDate}</div>
          <div style="margin-top: 8px;">
            <span class="delivery-badge ${deliveryClass}">${getDeliveryLabel(order.delivery_method)}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Dados do Cliente</div>
        <div class="customer-info">
          <div class="info-block">
            <div class="info-label">Nome</div>
            <div class="info-value">${order.customer_name}</div>
          </div>
          <div class="info-block">
            <div class="info-label">Telefone</div>
            <div class="info-value">${order.customer_phone}</div>
          </div>
        </div>
        ${order.delivery_method !== 'pickup' ? `
          <div class="info-block" style="margin-top: 8px;">
            <div class="info-label">Endereço de Entrega</div>
            <div class="info-value">${order.customer_address || 'Não informado'}</div>
          </div>
        ` : ''}
      </div>

      <div class="section">
        <div class="section-title">Itens do Pedido (${totalItems} ${totalItems === 1 ? 'item' : 'itens'})</div>
        <table class="items-table">
          <thead>
            <tr>
              <th class="checkbox-col">✓</th>
              <th style="width: 50px;">Foto</th>
              <th>Produto / SKU</th>
              <th style="text-align: center; width: 80px;">Tamanho</th>
              <th style="text-align: center; width: 50px;">Qtd</th>
              <th style="text-align: right; width: 100px;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-box">
            <div class="total-row grand-total">
              <span>Total:</span>
              <span>${formatCurrency(order.total)}</span>
            </div>
          </div>
        </div>
      </div>

      ${(order.customer_notes || order.internal_notes) ? `
        <div class="notes-section">
          ${order.customer_notes ? `
            <div class="notes-box">
              <div class="notes-title">📝 Observação do Cliente</div>
              <div class="notes-content">${order.customer_notes}${order.delivery_period ? `\n\nPeríodo: ${order.delivery_period === 'manha' ? 'Manhã' : order.delivery_period === 'tarde' ? 'Tarde' : 'Qualquer horário'}` : ''}</div>
            </div>
          ` : '<div></div>'}
          ${order.internal_notes ? `
            <div class="notes-box">
              <div class="notes-title">⚠️ Observação Interna</div>
              <div class="notes-content">${order.internal_notes}</div>
            </div>
          ` : '<div></div>'}
        </div>
      ` : ''}

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Separado por</div>
        </div>
        <div class="signature-box">
          <div class="signature-line"></div>
          <div class="signature-label">Conferido por</div>
        </div>
      </div>
    </div>
  `;
};

// Convert image to data URL for print
const loadImageAsDataUrl = async (src: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => resolve("");
    img.src = src;
  });
};

export function OrderPackingSlipPrint({ order, items, variant = "button" }: OrderPackingSlipPrintProps) {
  const handlePrint = async () => {
    if (items.length === 0) {
      toast.error("Nenhum item no pedido");
      return;
    }

    // Load logo as data URL
    const logoDataUrl = await loadImageAsDataUrl(logoLepoa);

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error("Não foi possível abrir janela de impressão");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Romaneio #${order.id.slice(0, 8).toUpperCase()}</title>
          <style>${getPackingSlipStyles()}</style>
        </head>
        <body>
          ${generatePackingSlipHtml(order, items, logoDataUrl)}
          <script>
            setTimeout(() => { window.print(); }, 500);
          <\/script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  if (variant === "icon") {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={(e) => {
          e.stopPropagation();
          handlePrint();
        }}
        title="Imprimir romaneio"
      >
        <FileText className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={(e) => {
        e.stopPropagation();
        handlePrint();
      }}
    >
      <FileText className="h-4 w-4" />
      Imprimir Pedido
    </Button>
  );
}

// Batch print multiple orders
interface BatchPackingSlipPrintProps {
  orders: Array<{ order: Order; items: OrderItem[] }>;
}

export function BatchPackingSlipPrint({ orders }: BatchPackingSlipPrintProps) {
  const handleBatchPrint = async () => {
    if (orders.length === 0) {
      toast.error("Nenhum pedido selecionado");
      return;
    }

    // Load logo once
    const logoDataUrl = await loadImageAsDataUrl(logoLepoa);

    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) {
      toast.error("Não foi possível abrir janela de impressão");
      return;
    }

    const allSlipsHtml = orders
      .map(({ order, items }) => generatePackingSlipHtml(order, items, logoDataUrl))
      .join('<div style="page-break-before: always;"></div>');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Romaneios - ${orders.length} pedidos</title>
          <style>${getPackingSlipStyles()}</style>
        </head>
        <body>
          ${allSlipsHtml}
          <script>
            setTimeout(() => { window.print(); }, 500);
          <\/script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleBatchPrint}
      disabled={orders.length === 0}
    >
      <Printer className="h-4 w-4" />
      Imprimir Romaneios ({orders.length})
    </Button>
  );
}
