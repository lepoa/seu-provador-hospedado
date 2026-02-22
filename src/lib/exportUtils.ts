import type ExcelJS from "exceljs";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { LiveEventSummary } from "@/hooks/useLiveReportsByPeriod";
import type { LiveReportKPIs, TopProduct } from "@/hooks/useLiveReports";
import { loadExcelJS } from "@/lib/loadExcel";

interface ExportPeriodData {
  events: LiveEventSummary[];
  kpis: LiveReportKPIs | null;
  topProducts: TopProduct[];
  startDate: Date;
  endDate: Date;
}

const formatPrice = (price: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(price);
};

const formatDate = (date: string | Date) => {
  return format(new Date(date), "dd/MM/yyyy HH:mm", { locale: ptBR });
};

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// Helper to trigger download from ExcelJS buffer
async function downloadExcelBuffer(workbook: ExcelJS.Workbook, filename: string) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

// ============= CSV Export =============

export function exportPeriodReportToCSV(data: ExportPeriodData) {
  const { events, kpis, topProducts, startDate, endDate } = data;
  
  const periodLabel = `${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}`;
  
  let csvContent = "";
  
  // Header info
  csvContent += `Relatório de Lives - ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}\n\n`;
  
  // KPIs Summary
  csvContent += "=== RESUMO DO PERÍODO ===\n";
  if (kpis) {
    csvContent += `Total Reservado;${formatPrice(kpis.totalReservado)}\n`;
    csvContent += `Total Pago;${formatPrice(kpis.totalPago)}\n`;
    csvContent += `Itens Reservados;${kpis.totalItensReservados}\n`;
    csvContent += `Itens Pagos;${kpis.totalItensPagos}\n`;
    csvContent += `Ticket Médio;${formatPrice(kpis.ticketMedioPago)}\n`;
    csvContent += `Total de Carrinhos;${kpis.totalCarrinhos}\n`;
    csvContent += `Carrinhos Pagos;${kpis.carrinhosPagos}\n`;
    csvContent += `Taxa de Conversão;${formatPercent(kpis.taxaConversao)}\n`;
    csvContent += `Taxa de Pagamento;${formatPercent(kpis.taxaPagamento)}\n`;
    csvContent += `Duração Total;${(kpis.duracaoMinutos / 60).toFixed(1)} horas\n`;
    csvContent += `Vendas por Hora;${formatPrice(kpis.vendasPorHora)}\n`;
  }
  
  csvContent += "\n";
  
  // Events List
  csvContent += "=== LIVES NO PERÍODO ===\n";
  csvContent += "Título;Data/Hora Início;Status;Total Reservado;Total Pago;Carrinhos;Carrinhos Pagos\n";
  events.forEach((event) => {
    csvContent += `${event.titulo};${formatDate(event.data_hora_inicio)};${event.status};${formatPrice(event.totalReservado)};${formatPrice(event.totalPago)};${event.totalCarrinhos};${event.carrinhosPagos}\n`;
  });
  
  csvContent += "\n";
  
  // Top Products
  csvContent += "=== TOP PRODUTOS ===\n";
  csvContent += "Produto;Cor;Quantidade Vendida;Valor Total\n";
  topProducts.forEach((product) => {
    csvContent += `${product.productName};${product.productColor || "-"};${product.quantidadeVendida};${formatPrice(product.valorTotal)}\n`;
  });
  
  // Create and download
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio_lives_${periodLabel}.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

// ============= Excel Export =============

export async function exportPeriodReportToExcel(data: ExportPeriodData) {
  const { events, kpis, topProducts, startDate, endDate } = data;
  
  const periodLabel = `${format(startDate, "dd-MM-yyyy")}_a_${format(endDate, "dd-MM-yyyy")}`;
  
  const ExcelJS = await loadExcelJS();
  const wb = new ExcelJS.Workbook();
  
  // Sheet 1: Resumo
  const wsResumo = wb.addWorksheet("Resumo");
  wsResumo.columns = [{ width: 25 }, { width: 20 }];
  wsResumo.addRow(["RELATÓRIO DE LIVES POR PERÍODO"]);
  wsResumo.addRow([`Período: ${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`]);
  wsResumo.addRow([]);
  wsResumo.addRow(["INDICADOR", "VALOR"]);
  
  if (kpis) {
    wsResumo.addRow(["Total de Lives", events.length]);
    wsResumo.addRow(["Total Reservado", kpis.totalReservado]);
    wsResumo.addRow(["Total Pago", kpis.totalPago]);
    wsResumo.addRow(["Itens Reservados", kpis.totalItensReservados]);
    wsResumo.addRow(["Itens Pagos", kpis.totalItensPagos]);
    wsResumo.addRow(["Ticket Médio Reservado", kpis.ticketMedioReservado]);
    wsResumo.addRow(["Ticket Médio Pago", kpis.ticketMedioPago]);
    wsResumo.addRow(["Total de Carrinhos", kpis.totalCarrinhos]);
    wsResumo.addRow(["Carrinhos Abertos", kpis.carrinhosAbertos]);
    wsResumo.addRow(["Carrinhos Aguardando", kpis.carrinhosAguardando]);
    wsResumo.addRow(["Carrinhos Pagos", kpis.carrinhosPagos]);
    wsResumo.addRow(["Taxa de Conversão (%)", kpis.taxaConversao]);
    wsResumo.addRow(["Taxa de Pagamento (%)", kpis.taxaPagamento]);
    wsResumo.addRow(["Duração Total (min)", kpis.duracaoMinutos]);
    wsResumo.addRow(["Vendas por Hora", kpis.vendasPorHora]);
  }
  
  // Sheet 2: Lives
  const wsLives = wb.addWorksheet("Lives");
  wsLives.columns = [
    { width: 30 }, { width: 18 }, { width: 12 }, { width: 18 },
    { width: 15 }, { width: 12 }, { width: 15 }, { width: 18 }
  ];
  wsLives.addRow(["TÍTULO", "DATA/HORA", "STATUS", "TOTAL RESERVADO", "TOTAL PAGO", "CARRINHOS", "CARRINHOS PAGOS", "TAXA CONVERSÃO (%)"]);
  
  events.forEach((event) => {
    const taxaConversao = event.totalCarrinhos > 0 
      ? (event.carrinhosPagos / event.totalCarrinhos * 100) 
      : 0;
    wsLives.addRow([
      event.titulo,
      formatDate(event.data_hora_inicio),
      event.status,
      event.totalReservado,
      event.totalPago,
      event.totalCarrinhos,
      event.carrinhosPagos,
      Number(taxaConversao.toFixed(1)),
    ]);
  });
  
  // Sheet 3: Top Produtos
  const wsProdutos = wb.addWorksheet("Produtos");
  wsProdutos.columns = [{ width: 40 }, { width: 15 }, { width: 20 }, { width: 18 }];
  wsProdutos.addRow(["PRODUTO", "COR", "QUANTIDADE VENDIDA", "VALOR TOTAL"]);
  
  topProducts.forEach((product) => {
    wsProdutos.addRow([
      product.productName,
      product.productColor || "-",
      product.quantidadeVendida,
      product.valorTotal,
    ]);
  });
  
  // Download
  await downloadExcelBuffer(wb, `relatorio_lives_${periodLabel}.xlsx`);
}
