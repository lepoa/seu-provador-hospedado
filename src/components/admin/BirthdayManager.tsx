import { useState } from "react";
import {
    Cake,
    MessageSquare,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    Filter,
    Loader2,
    ExternalLink,
    Gift,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBirthdayAdmin, BirthdayMember } from "@/hooks/useBirthdayAdmin";
import { BIRTHDAY_DISCOUNT_BY_TIER } from "@/hooks/useBirthdayDiscount";
import { toast } from "sonner";

const MONTH_NAMES = [
    "", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIER_LABELS: Record<string, string> = {
    poa: "Poá",
    poa_gold: "Gold",
    poa_platinum: "Platinum",
    poa_black: "Black",
};

export function BirthdayManager() {
    const {
        members,
        allMembers,
        isLoading,
        selectedMonth,
        setSelectedMonth,
        statusFilter,
        setStatusFilter,
        stats,
        markNotified,
        ensureDiscount,
        refetch,
    } = useBirthdayAdmin();

    const [acting, setActing] = useState<string | null>(null);

    const handleNotify = async (member: BirthdayMember) => {
        setActing(member.userId);
        try {
            // Ensure discount exists
            let discountId = member.discountId;
            let couponCode = member.couponCode;
            let discountPercent = member.discountPercent;

            if (!discountId) {
                const result = await ensureDiscount(member.userId);
                if (result) {
                    discountId = result.discount_id;
                    couponCode = result.coupon_code;
                    discountPercent = result.discount_percent;
                }
            }

            if (discountId) {
                await markNotified(discountId, false);
            }

            // Open WhatsApp with personalized message
            const name = member.name.split(" ")[0];
            const message = encodeURIComponent(
                `Olá ${name}! 🎂\n\n` +
                `Feliz aniversário! Como membro ${TIER_LABELS[member.tier] || "Poá"} do Le.Poá Club, ` +
                `preparamos um presente especial para você:\n\n` +
                `🎁 ${discountPercent || BIRTHDAY_DISCOUNT_BY_TIER[member.tier]}% de desconto ` +
                `na sua próxima compra este mês!\n\n` +
                `Use o cupom: *${couponCode || "—"}*\n\n` +
                `Válido até o final do mês. Aproveite! 💛`
            );

            if (member.whatsapp) {
                const phone = member.whatsapp.replace(/\D/g, "");
                const whatsappUrl = `https://wa.me/55${phone}?text=${message}`;
                window.open(whatsappUrl, "_blank");
            } else {
                // Copy message to clipboard if no WhatsApp
                await navigator.clipboard.writeText(decodeURIComponent(message));
                toast.info("Sem WhatsApp cadastrado. Mensagem copiada para a área de transferência.");
            }

            toast.success(`${name} marcada como notificada`);
        } catch (error) {
            console.error("Error notifying:", error);
            toast.error("Erro ao notificar");
        } finally {
            setActing(null);
        }
    };

    const handleRenotify = async (member: BirthdayMember) => {
        if (!member.discountId) return;

        setActing(member.userId);
        try {
            await markNotified(member.discountId, true);

            const name = member.name.split(" ")[0];
            const daysLeft = getDaysLeftInMonth();
            const message = encodeURIComponent(
                `Oi ${name}! 💛\n\n` +
                `Lembrete: seu desconto de aniversário de ` +
                `${member.discountPercent}% ainda está ativo!\n\n` +
                `Faltam apenas ${daysLeft} dias para usar. ` +
                `Não perca essa oportunidade!\n\n` +
                `Cupom: *${member.couponCode}*\n\n` +
                `Acesse: seuprovador.com.br`
            );

            if (member.whatsapp) {
                const phone = member.whatsapp.replace(/\D/g, "");
                window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
            } else {
                await navigator.clipboard.writeText(decodeURIComponent(message));
                toast.info("Mensagem copiada para a área de transferência.");
            }

            toast.success(`Reaviso enviado para ${name}`);
        } catch (error) {
            toast.error("Erro ao reenviar");
        } finally {
            setActing(null);
        }
    };

    function getDaysLeftInMonth() {
        const now = new Date();
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        return lastDay - now.getDate();
    }

    function getStatusBadge(member: BirthdayMember) {
        if (member.usedAt) {
            return <Badge variant="default" className="bg-green-600 text-white">Usou desconto</Badge>;
        }
        if (member.renotifiedAt) {
            return <Badge variant="outline" className="border-amber-500 text-amber-600">Reavisada</Badge>;
        }
        if (member.notifiedAt) {
            return <Badge variant="outline" className="border-blue-500 text-blue-600">Notificada</Badge>;
        }
        if (member.discountId) {
            return <Badge variant="outline" className="border-gray-400 text-gray-500">Não notificada</Badge>;
        }
        return <Badge variant="outline" className="border-gray-300 text-gray-400">Sem desconto</Badge>;
    }

    const isCurrentMonth = selectedMonth === new Date().getMonth() + 1;

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3">
                    <Select
                        value={String(selectedMonth)}
                        onValueChange={(v) => setSelectedMonth(Number(v))}
                    >
                        <SelectTrigger className="w-[160px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {MONTH_NAMES.slice(1).map((name, i) => (
                                <SelectItem key={i + 1} value={String(i + 1)}>
                                    {name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="ghost" size="icon" onClick={refetch} disabled={isLoading}>
                        <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>

                <Select
                    value={statusFilter}
                    onValueChange={(v) => setStatusFilter(v as any)}
                >
                    <SelectTrigger className="w-[200px]">
                        <Filter className="h-4 w-4 mr-2" />
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas ({stats.total})</SelectItem>
                        <SelectItem value="not_notified">Não notificadas ({stats.notNotified})</SelectItem>
                        <SelectItem value="notified_not_used">Notificadas s/ uso ({stats.notifiedNotUsed})</SelectItem>
                        <SelectItem value="used">Usaram desconto ({stats.used})</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card>
                    <CardContent className="p-4 text-center">
                        <Cake className="h-5 w-5 mx-auto mb-1 text-pink-500" />
                        <div className="text-2xl font-bold">{stats.total}</div>
                        <div className="text-xs text-muted-foreground">Aniversariantes</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <AlertCircle className="h-5 w-5 mx-auto mb-1 text-gray-400" />
                        <div className="text-2xl font-bold">{stats.notNotified}</div>
                        <div className="text-xs text-muted-foreground">Não notificadas</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <Clock className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                        <div className="text-2xl font-bold">{stats.notifiedNotUsed}</div>
                        <div className="text-xs text-muted-foreground">Sem uso</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-4 text-center">
                        <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                        <div className="text-2xl font-bold">{stats.used}</div>
                        <div className="text-xs text-muted-foreground">Usaram</div>
                    </CardContent>
                </Card>
            </div>

            {/* Members List */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : members.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                    <Cake className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhuma aniversariante {statusFilter !== "all" ? "com esse filtro " : ""}em {MONTH_NAMES[selectedMonth]}</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {members.map((member) => (
                        <Card key={member.userId} className="overflow-hidden">
                            <CardContent className="p-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-medium truncate">{member.name}</span>
                                            {getStatusBadge(member)}
                                        </div>
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                            <span>
                                                {new Date(member.birthDate + "T12:00:00").toLocaleDateString("pt-BR", {
                                                    day: "numeric",
                                                    month: "long",
                                                })}
                                            </span>
                                            <span className="font-medium">{TIER_LABELS[member.tier] || "Poá"}</span>
                                            {member.discountPercent && (
                                                <span className="text-green-600 font-medium">
                                                    {member.discountPercent}% off
                                                </span>
                                            )}
                                            {member.couponCode && (
                                                <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
                                                    {member.couponCode}
                                                </span>
                                            )}
                                        </div>
                                        {/* Timeline */}
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground mt-2">
                                            {member.notifiedAt && (
                                                <span>Notificada: {new Date(member.notifiedAt).toLocaleDateString("pt-BR")}</span>
                                            )}
                                            {member.renotifiedAt && (
                                                <span>Reaviso: {new Date(member.renotifiedAt).toLocaleDateString("pt-BR")}</span>
                                            )}
                                            {member.usedAt && (
                                                <span className="text-green-600">
                                                    Usou: {new Date(member.usedAt).toLocaleDateString("pt-BR")}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 shrink-0">
                                        {!member.usedAt && (
                                            <>
                                                {!member.notifiedAt ? (
                                                    <Button
                                                        size="sm"
                                                        onClick={() => handleNotify(member)}
                                                        disabled={acting === member.userId}
                                                        className="gap-1.5"
                                                    >
                                                        {acting === member.userId ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <MessageSquare className="h-3.5 w-3.5" />
                                                        )}
                                                        Enviar mensagem
                                                    </Button>
                                                ) : !member.renotifiedAt ? (
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => handleRenotify(member)}
                                                        disabled={acting === member.userId}
                                                        className="gap-1.5"
                                                    >
                                                        {acting === member.userId ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                        ) : (
                                                            <RefreshCw className="h-3.5 w-3.5" />
                                                        )}
                                                        Reaviso
                                                    </Button>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">
                                                        Já reavisada
                                                    </span>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* Legend Footer */}
            {!isLoading && isCurrentMonth && stats.total > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                        <strong>Dica:</strong> Próximo ao final do mês, use o botão "Reaviso" para lembrar
                        as clientes que ainda não usaram o desconto de aniversário. Faltam{" "}
                        <strong>{getDaysLeftInMonth()} dias</strong> para encerrar as promoções deste mês.
                    </p>
                </div>
            )}
        </div>
    );
}
