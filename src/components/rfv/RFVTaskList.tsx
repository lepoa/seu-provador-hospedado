import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  DollarSign,
  MessageCircle,
  Phone,
  ShoppingBag,
  SkipForward,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";
import type { RFVTask } from "@/hooks/useRFVData";

interface Props {
  tasks: RFVTask[];
  onUpdateStatus: (taskId: string, status: string) => void;
  isLoading: boolean;
}

const SEGMENT_CONFIG: Record<string, { label: string }> = {
  campeao: { label: "Campeao" },
  fiel: { label: "Fiel" },
  promissor: { label: "Promissor" },
  atencao: { label: "Atencao" },
  hibernando: { label: "Hibernando" },
  risco: { label: "Em risco" },
  novo: { label: "Novo" },
};

const CHANNEL_CONFIG: Record<string, { label: string }> = {
  live: { label: "Live" },
  site: { label: "Site" },
  hybrid: { label: "Hibrido" },
  general: { label: "Geral" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string; dot: string }> = {
  critical: { color: "border-red-200 bg-red-50/50", label: "Critica", dot: "!" },
  high: { color: "border-amber-200 bg-amber-50/50", label: "Alta", dot: "!" },
  medium: { color: "border-emerald-200 bg-emerald-50/50", label: "Media", dot: "-" },
  low: { color: "border-slate-200 bg-slate-50/50", label: "Baixa", dot: "-" },
};

const TYPE_LABELS: Record<string, string> = {
  post_sale: "Pos-venda",
  preventive: "Preventivo",
  reactivation: "Reativacao",
  vip: "VIP",
  frequency_drop: "Perda de frequencia",
  channel_migration: "Migracao de canal",
};

const STATUS_LABELS: Record<string, string> = {
  todo: "A fazer",
  sent: "Enviado",
  replied: "Respondeu",
  won: "Converteu",
  no_reply: "Sem resposta",
  skipped: "Pulado",
};

export function RFVTaskList({ tasks, onUpdateStatus, isLoading }: Props) {
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card className="border-dashed border-2 border-purple-200">
        <CardContent className="py-12 text-center text-muted-foreground">
          <p className="text-lg mb-2">Nenhuma tarefa gerada</p>
          <p className="text-sm">Use o botao Gerar tarefas do dia para montar a operacao.</p>
        </CardContent>
      </Card>
    );
  }

  const copyMessage = async (task: RFVTask) => {
    try {
      await navigator.clipboard.writeText(task.suggested_message);
      setCopiedId(task.id);
      toast.success("Mensagem copiada");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Erro ao copiar mensagem");
    }
  };

  const openWhatsApp = (task: RFVTask) => {
    if (!task.customer_phone) {
      toast.error("Telefone nao disponivel");
      return;
    }

    const phone = task.customer_phone.replace(/\D/g, "");
    const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const text = encodeURIComponent(task.suggested_message || "");
    window.open(`https://wa.me/${fullPhone}?text=${text}`, "_blank");
  };

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
        const segment = SEGMENT_CONFIG[task.rfv_segment || "novo"] || SEGMENT_CONFIG.novo;
        const channel = CHANNEL_CONFIG[task.channel_context] || CHANNEL_CONFIG.site;
        const isExpanded = expandedId === task.id;
        const isCopied = copiedId === task.id;

        return (
          <Card key={task.id} className={`transition-all hover:shadow-md ${priority.color}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div
                    className="flex items-center flex-wrap gap-2 mb-1 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => navigate(`/dashboard/clientes/${task.customer_id}`)}
                    title="Ver perfil da cliente"
                  >
                    <span className="font-semibold truncate">{task.customer_name}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {segment.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {channel.label}
                    </Badge>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {priority.dot} {priority.label}
                    </Badge>
                    <Badge className="text-xs shrink-0">{STATUS_LABELS[task.status] || task.status}</Badge>
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">
                      {TYPE_LABELS[task.task_type] || task.task_type}
                    </span>
                    <span>·</span>
                    <span className="truncate">{task.reason}</span>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>Recencia: <strong>{task.recency_days ?? "-"}d</strong></span>
                    <span>Ciclo medio: <strong>{task.cycle_mean_days ? `${Math.round(task.cycle_mean_days)}d` : "-"}</strong></span>
                    <span>Aderencia: <strong>{task.adherence_ratio ? `${task.adherence_ratio.toFixed(2)}x` : "-"}</strong></span>
                    <span className="inline-flex items-center gap-1 text-emerald-700">
                      <DollarSign className="h-3 w-3" />
                      Impacto: <strong>R$ {(task.estimated_impact || 0).toFixed(2)}</strong>
                    </span>
                  </div>

                  {task.revenue_generated > 0 && (
                    <div className="text-xs text-blue-700 mt-1 font-semibold flex items-center gap-1">
                      <ShoppingBag className="h-3 w-3" />
                      Receita atribuida: R$ {task.revenue_generated.toFixed(2)}
                    </div>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setExpandedId(isExpanded ? null : task.id)}
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t space-y-3">
                  <div className="bg-white rounded-lg p-3 text-sm border">
                    <div className="text-xs font-medium text-muted-foreground mb-1">Mensagem sugerida</div>
                    <p className="whitespace-pre-wrap">{task.suggested_message}</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => copyMessage(task)} className="gap-1">
                      {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      {isCopied ? "Copiado" : "Copiar"}
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openWhatsApp(task)}
                      className="gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>

                    <div className="flex-1" />

                    {task.status === "todo" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onUpdateStatus(task.id, "sent")}
                          className="gap-1 bg-blue-600 hover:bg-blue-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          CHECK
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onUpdateStatus(task.id, "skipped")}
                          className="gap-1 text-muted-foreground"
                        >
                          <SkipForward className="h-3.5 w-3.5" />
                          Pular
                        </Button>
                      </>
                    )}

                    {task.status === "sent" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onUpdateStatus(task.id, "replied")}
                          className="gap-1 bg-amber-600 hover:bg-amber-700"
                        >
                          <MessageCircle className="h-3.5 w-3.5" />
                          Respondeu
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => onUpdateStatus(task.id, "won")}
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          Converteu
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onUpdateStatus(task.id, "no_reply")}
                          className="gap-1 text-muted-foreground"
                        >
                          Sem resposta
                        </Button>
                      </>
                    )}

                    {task.status === "replied" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => onUpdateStatus(task.id, "won")}
                          className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <ShoppingBag className="h-3.5 w-3.5" />
                          Converteu
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onUpdateStatus(task.id, "no_reply")}
                          className="gap-1 text-muted-foreground"
                        >
                          Sem resposta
                        </Button>
                      </>
                    )}

                    {task.status !== "todo" && task.status !== "won" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onUpdateStatus(task.id, "todo")}
                        className="gap-1"
                      >
                        <Undo2 className="h-3.5 w-3.5" />
                        Reabrir
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
