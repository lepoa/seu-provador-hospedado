import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Copy, Check, Send, MessageCircle, ShoppingBag, XCircle,
    ChevronDown, ChevronUp, Phone, TrendingUp, DollarSign
} from "lucide-react";
import { toast } from "sonner";
import type { RFVTask } from "@/hooks/useRFVData";

interface Props {
    tasks: RFVTask[];
    onUpdateStatus: (taskId: string, status: string) => void;
    isLoading: boolean;
}

const SEGMENT_CONFIG: Record<string, { emoji: string; label: string }> = {
    campeao: { emoji: "🏆", label: "Campeão" },
    fiel: { emoji: "💎", label: "Fiel" },
    promissor: { emoji: "🌱", label: "Promissor" },
    atencao: { emoji: "👀", label: "Atenção" },
    hibernando: { emoji: "😴", label: "Hibernando" },
    risco: { emoji: "🔴", label: "Em Risco" },
    novo: { emoji: "✨", label: "Novo" },
};

const CHANNEL_CONFIG: Record<string, { emoji: string; label: string }> = {
    live_only: { emoji: "🎥", label: "Live" },
    site_only: { emoji: "🛒", label: "Site" },
    hybrid: { emoji: "🔀", label: "Híbrido" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string; dot: string }> = {
    critico: { color: "border-red-200 bg-red-50/50", label: "Crítico", dot: "🔴" },
    importante: { color: "border-amber-200 bg-amber-50/50", label: "Importante", dot: "🟡" },
    oportunidade: { color: "border-emerald-200 bg-emerald-50/50", label: "Oportunidade", dot: "🟢" },
};

const TYPE_LABELS: Record<string, string> = {
    pos_compra: "Pós-compra",
    preventivo: "Preventivo",
    reativacao: "Reativação",
    vip: "VIP",
    perda_frequencia: "Perda Frequência",
    migrar_canal: "Migrar Canal",
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
                    <p className="text-lg mb-2">Nenhuma tarefa encontrada</p>
                    <p className="text-sm">Clique em "Recalcular RFV" para gerar novas tarefas</p>
                </CardContent>
            </Card>
        );
    }

    const copyMessage = async (task: RFVTask) => {
        try {
            await navigator.clipboard.writeText(task.suggested_message);
            setCopiedId(task.id);
            toast.success("Mensagem copiada!");
            setTimeout(() => setCopiedId(null), 2000);
        } catch {
            toast.error("Erro ao copiar");
        }
    };

    const openWhatsApp = (task: RFVTask) => {
        if (!task.customer_phone) {
            toast.error("Telefone não disponível");
            return;
        }
        const phone = task.customer_phone.replace(/\D/g, "");
        const fullPhone = phone.startsWith("55") ? phone : `55${phone}`;
        const msg = encodeURIComponent(task.suggested_message);
        window.open(`https://wa.me/${fullPhone}?text=${msg}`, "_blank");
    };

    return (
        <div className="space-y-3">
            {tasks.map((task) => {
                const priority = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.oportunidade;
                const segment = SEGMENT_CONFIG[task.rfv_segment || "novo"] || SEGMENT_CONFIG.novo;
                const channel = CHANNEL_CONFIG[task.channel_context] || CHANNEL_CONFIG.site_only;
                const isExpanded = expandedId === task.id;
                const isCopied = copiedId === task.id;

                return (
                    <Card
                        key={task.id}
                        className={`transition-all hover:shadow-md ${priority.color}`}
                    >
                        <CardContent className="p-4">
                            {/* Main row */}
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div
                                        className="flex items-center flex-wrap gap-2 mb-1 cursor-pointer hover:opacity-75 transition-opacity"
                                        onClick={() => navigate(`/dashboard/clientes/${task.customer_id}`)}
                                        title="Ver perfil completo"
                                    >
                                        <span className="font-semibold truncate group-hover:underline decoration-purple-400 decoration-2 underline-offset-2 transition-all">{task.customer_name}</span>
                                        <div className="flex items-center gap-1 bg-purple-50 px-2 py-0.5 rounded text-[10px] font-bold text-purple-700 border border-purple-100 shrink-0">
                                            <TrendingUp className="h-3 w-3" />
                                            {task.repurchase_probability_score || 0}% Prob.
                                        </div>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {segment.emoji} {segment.label}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {channel.emoji} {channel.label}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs shrink-0">
                                            {priority.dot} {priority.label}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span className="font-medium text-foreground">{TYPE_LABELS[task.task_type] || task.task_type}</span>
                                        <span>·</span>
                                        <span className="truncate">{task.reason}</span>
                                    </div>
                                    {task.estimated_impact > 0 && task.status === 'pendente' && (
                                        <div className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                                            <DollarSign className="h-3 w-3" />
                                            Impacto estimado: R$ {task.estimated_impact.toFixed(2)}
                                        </div>
                                    )}
                                    {task.revenue_generated > 0 && (
                                        <div className="text-xs text-blue-700 mt-1 font-bold flex items-center gap-1">
                                            <ShoppingBag className="h-3 w-3" />
                                            Receita gerada: R$ {task.revenue_generated.toFixed(2)}
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

                            {/* Expanded content */}
                            {isExpanded && (
                                <div className="mt-3 pt-3 border-t space-y-3">
                                    {/* Message */}
                                    <div className="bg-white rounded-lg p-3 text-sm border">
                                        <div className="text-xs font-medium text-muted-foreground mb-1">💬 Mensagem sugerida:</div>
                                        <p className="whitespace-pre-wrap">{task.suggested_message}</p>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex flex-wrap gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => copyMessage(task)}
                                            className="gap-1"
                                        >
                                            {isCopied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                            {isCopied ? "Copiado!" : "Copiar"}
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

                                        {task.status === "pendente" && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => onUpdateStatus(task.id, "enviado")}
                                                    className="gap-1 bg-blue-600 hover:bg-blue-700"
                                                >
                                                    <Send className="h-3.5 w-3.5" />
                                                    Enviado
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onUpdateStatus(task.id, "sem_resposta")}
                                                    className="gap-1 text-muted-foreground"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    Sem resposta
                                                </Button>
                                            </>
                                        )}

                                        {task.status === "enviado" && (
                                            <>
                                                <Button
                                                    size="sm"
                                                    onClick={() => onUpdateStatus(task.id, "respondeu")}
                                                    className="gap-1 bg-amber-600 hover:bg-amber-700"
                                                >
                                                    <MessageCircle className="h-3.5 w-3.5" />
                                                    Respondeu
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    onClick={() => onUpdateStatus(task.id, "converteu")}
                                                    className="gap-1 bg-emerald-600 hover:bg-emerald-700"
                                                >
                                                    <ShoppingBag className="h-3.5 w-3.5" />
                                                    Converteu
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => onUpdateStatus(task.id, "sem_resposta")}
                                                    className="gap-1 text-muted-foreground"
                                                >
                                                    <XCircle className="h-3.5 w-3.5" />
                                                    Sem resposta
                                                </Button>
                                            </>
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
