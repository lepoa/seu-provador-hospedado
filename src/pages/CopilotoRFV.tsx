import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  RefreshCw,
  Brain,
  Users,
  TrendingUp,
  Target,
  Zap,
  Filter,
  ChevronDown,
  Settings,
  CheckCircle2,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { useRFVData, RFVTask } from "@/hooks/useRFVData";
import { RFVKPICards } from "@/components/rfv/RFVKPICards";
import { RFVTaskList } from "@/components/rfv/RFVTaskList";
import { RFVSegmentChart } from "@/components/rfv/RFVSegmentChart";
import { RFVChannelChart } from "@/components/rfv/RFVChannelChart";
import { RFVTemplateManager } from "@/components/rfv/RFVTemplateManager";
import { RFVPerformanceInsights } from "@/components/rfv/RFVPerformanceInsights";
import { loadExcelJS } from "@/lib/loadExcel";
import logoLepoa from "@/assets/logo-lepoa.png";

export default function CopilotoRFV() {
  const navigate = useNavigate();
  const {
    metrics,
    tasks,
    todayTasks,
    backlogTasks,
    summary,
    isLoading,
    isRecalculating,
    recalculate,
    updateTaskStatus,
    reload,
    templates,
    saveTemplate,
  } = useRFVData();

  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filteredTodayTasks = todayTasks.filter((task: RFVTask) => {
    if (channelFilter !== "all" && task.channel_context !== channelFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (typeFilter !== "all" && task.task_type !== typeFilter) return false;
    return true;
  });

  const filteredBacklogTasks = backlogTasks.filter((task: RFVTask) => {
    if (channelFilter !== "all" && task.channel_context !== channelFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (typeFilter !== "all" && task.task_type !== typeFilter) return false;
    return true;
  });

  const criticalCount = filteredTodayTasks.filter(
    (task: RFVTask) => task.priority === "critical" && task.status === "todo"
  ).length;
  const highCount = filteredTodayTasks.filter(
    (task: RFVTask) => task.priority === "high" && task.status === "todo"
  ).length;
  const mediumCount = filteredTodayTasks.filter(
    (task: RFVTask) => task.priority === "medium" && task.status === "todo"
  ).length;

  const handleExportCSV = () => {
    if (!tasks || tasks.length === 0) return;

    const headers = [
      "Cliente",
      "Telefone",
      "Segmento",
      "Canal",
      "Tipo de tarefa",
      "Probabilidade recompra",
      "Impacto estimado",
      "Prioridade",
      "Status",
      "Receita atribuida",
    ];

    const rows = tasks.map((task) => [
      task.customer_name || "",
      task.customer_phone || "",
      task.rfv_segment || "",
      task.channel_context || "",
      task.task_type || "",
      `${task.repurchase_probability_score || 0}%`,
      task.estimated_impact || 0,
      task.priority || "",
      task.status || "",
      task.revenue_generated || 0,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `copiloto-rfv-${new Date().toISOString().split("T")[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = async () => {
    if (!tasks || tasks.length === 0) return;

    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Copiloto RFV");

    worksheet.columns = [
      { header: "Cliente", key: "name", width: 30 },
      { header: "Telefone", key: "phone", width: 20 },
      { header: "Segmento", key: "segment", width: 15 },
      { header: "Canal", key: "channel", width: 15 },
      { header: "Tipo", key: "type", width: 20 },
      { header: "Probabilidade", key: "prob", width: 18 },
      { header: "Impacto", key: "impact", width: 15 },
      { header: "Prioridade", key: "priority", width: 12 },
      { header: "Status", key: "status", width: 12 },
      { header: "Receita", key: "revenue", width: 15 },
    ];

    tasks.forEach((task) => {
      worksheet.addRow({
        name: task.customer_name || "",
        phone: task.customer_phone || "",
        segment: task.rfv_segment || "",
        channel: task.channel_context || "",
        type: task.task_type || "",
        prob: `${task.repurchase_probability_score || 0}%`,
        impact: task.estimated_impact || 0,
        priority: task.priority || "",
        status: task.status || "",
        revenue: task.revenue_generated || 0,
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE9D5FF" },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `copiloto-rfv-${new Date().toISOString().split("T")[0]}.xlsx`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50/30 to-pink-50/20">
      <div className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}> 
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <img src={logoLepoa} alt="Le.Poa" className="h-8" />
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-purple-600" />
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-700 to-pink-600 bg-clip-text text-transparent">
                Copiloto RFV
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reload} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>

            <Button
              size="sm"
              onClick={recalculate}
              disabled={isRecalculating}
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              <Zap className={`h-4 w-4 mr-1 ${isRecalculating ? "animate-pulse" : ""}`} />
              {isRecalculating ? "Gerando..." : "Gerar tarefas do dia"}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={tasks.length === 0}>
                  <FileDown className="h-4 w-4 mr-1" />
                  Exportar
                  <ChevronDown className="h-4 w-4 ml-1 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleExportExcel}>Exportar Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCSV}>Exportar CSV (.csv)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        {summary && (
          <Card className="border-purple-100 bg-white/50 overflow-hidden">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-purple-600" />
                    <h2 className="font-bold text-gray-800">Disciplina operacional do dia</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {summary.dailyTaskDone >= summary.dailyTaskGoal && summary.dailyTaskGoal > 0
                      ? "Todas as tarefas operacionais de hoje foram concluídas."
                      : `Faltam ${summary.dailyTaskGoal - summary.dailyTaskDone} checks para fechar o dia.`}
                  </p>
                </div>

                <div className="flex-1 max-w-md space-y-2">
                  <div className="flex justify-between text-xs font-medium">
                    <span>
                      Progresso: {summary.dailyTaskDone} / {summary.dailyTaskGoal} tarefas
                    </span>
                    <span>
                      {summary.dailyTaskGoal > 0
                        ? Math.round((summary.dailyTaskDone / summary.dailyTaskGoal) * 100)
                        : 0}
                      %
                    </span>
                  </div>
                  <Progress
                    value={summary.dailyTaskGoal > 0 ? (summary.dailyTaskDone / summary.dailyTaskGoal) * 100 : 0}
                    className="h-2.5 bg-purple-100"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="bg-white">
            Hoje: {todayTasks.length} tarefas
          </Badge>
          <Badge variant="outline" className="bg-white">
            Pendentes anteriores: {backlogTasks.length}
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-2 space-y-6">
        {summary && <RFVKPICards summary={summary} />}
        {summary && <RFVPerformanceInsights insights={summary.performanceInsights} />}

        <Tabs defaultValue="tasks" className="space-y-4">
          <TabsList className="bg-white border">
            <TabsTrigger value="tasks" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Target className="h-4 w-4 mr-1" />
              Tarefas ({filteredTodayTasks.filter((task: RFVTask) => task.status === "todo").length})
            </TabsTrigger>
            <TabsTrigger value="segments" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Users className="h-4 w-4 mr-1" />
              Segmentos
            </TabsTrigger>
            <TabsTrigger value="channels" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <TrendingUp className="h-4 w-4 mr-1" />
              Canais
            </TabsTrigger>
            <TabsTrigger value="config" className="data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700">
              <Settings className="h-4 w-4 mr-1" />
              Configuracoes
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-sm px-3 py-1">
                  {criticalCount} Criticas
                </Badge>
              )}
              {highCount > 0 && (
                <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 text-sm px-3 py-1">
                  {highCount} Altas
                </Badge>
              )}
              {mediumCount > 0 && (
                <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 text-sm px-3 py-1">
                  {mediumCount} Medias
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <Filter className="h-4 w-4 text-muted-foreground" />

              <Select value={channelFilter} onValueChange={setChannelFilter}>
                <SelectTrigger className="w-[160px] bg-white">
                  <SelectValue placeholder="Canal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os canais</SelectItem>
                  <SelectItem value="live">Live</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="hybrid">Hibrido</SelectItem>
                  <SelectItem value="general">Geral</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[160px] bg-white">
                  <SelectValue placeholder="Prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="critical">Critica</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[200px] bg-white">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="post_sale">Pos-venda</SelectItem>
                  <SelectItem value="preventive">Preventivo</SelectItem>
                  <SelectItem value="reactivation">Reativacao</SelectItem>
                  <SelectItem value="vip">VIP</SelectItem>
                  <SelectItem value="frequency_drop">Perda de frequencia</SelectItem>
                  <SelectItem value="channel_migration">Migracao de canal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Tabs defaultValue="today" className="space-y-3">
              <TabsList className="bg-white border">
                <TabsTrigger value="today">Hoje ({filteredTodayTasks.length})</TabsTrigger>
                <TabsTrigger value="backlog">
                  Pendentes anteriores ({filteredBacklogTasks.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="today">
                <RFVTaskList tasks={filteredTodayTasks} onUpdateStatus={updateTaskStatus} isLoading={isLoading} />
              </TabsContent>
              <TabsContent value="backlog">
                <RFVTaskList tasks={filteredBacklogTasks} onUpdateStatus={updateTaskStatus} isLoading={isLoading} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="segments">
            {summary && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RFVSegmentChart distribution={summary.segmentDistribution} total={summary.totalCustomers} />

                <Card className="border-purple-100">
                  <CardHeader>
                    <CardTitle className="text-base">Detalhamento por segmento</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(summary.segmentDistribution)
                        .sort(([, a], [, b]) => b - a)
                        .map(([segment, count]) => {
                          const pct = ((count / summary.totalCustomers) * 100).toFixed(1);
                          return (
                            <div key={segment} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">{getSegmentEmoji(segment)}</span>
                                <span className="font-medium capitalize">{segment}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="w-32 bg-gray-100 rounded-full h-2">
                                  <div
                                    className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-sm text-muted-foreground w-16 text-right">
                                  {count} ({pct}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="channels">
            {summary && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RFVChannelChart distribution={summary.channelDistribution} total={summary.totalCustomers} />

                <Card className="border-purple-100">
                  <CardHeader>
                    <CardTitle className="text-base">Metricas por canal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { key: "live", label: "Live" },
                        { key: "site", label: "Site" },
                        { key: "hybrid", label: "Hibrido" },
                      ].map(({ key, label }) => {
                        const channelMetrics = metrics.filter((metric) => metric.purchase_channel === key);
                        const count = channelMetrics.length;
                        const avgTicket =
                          count > 0
                            ? channelMetrics.reduce((sum, metric) => sum + metric.avg_ticket, 0) / count
                            : 0;
                        const totalRevenue = channelMetrics.reduce(
                          (sum, metric) => sum + metric.monetary_value,
                          0
                        );

                        return (
                          <div key={key} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium">{label}</span>
                              <Badge variant="outline">{count} clientes</Badge>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                              <div>
                                Ticket medio: <span className="font-semibold text-foreground">R$ {avgTicket.toFixed(2)}</span>
                              </div>
                              <div>
                                Receita total: <span className="font-semibold text-foreground">R$ {totalRevenue.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="config">
            <RFVTemplateManager templates={templates} onSave={saveTemplate} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function getSegmentEmoji(segment: string): string {
  const map: Record<string, string> = {
    campeao: "A",
    fiel: "B",
    promissor: "C",
    atencao: "D",
    hibernando: "E",
    risco: "R",
    novo: "N",
  };
  return map[segment] || "?";
}

