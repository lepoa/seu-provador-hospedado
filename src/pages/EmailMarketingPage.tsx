import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Mail, Send, Clock, Users, ShoppingBag, UserCheck, Eye, Loader2,
    ChevronRight, Save, BarChart2, FileText, TrendingUp, MousePointerClick,
    MailOpen, Edit3, Check, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useEmailCampaigns, useSendCampaign, CampaignSegment } from "@/hooks/useEmailCampaigns";
import { useEmailTemplates, useUpdateEmailTemplate, EmailTemplate } from "@/hooks/useEmailTemplates";
import { useEmailAnalytics } from "@/hooks/useEmailAnalytics";
import { marketingBaseEmail } from "@/emails/marketingBaseEmail";

// ─── Constants ────────────────────────────────────────────────────────────────

const SEGMENT_OPTIONS: { value: CampaignSegment; label: string; desc: string; icon: React.ReactNode }[] = [
    { value: "all", label: "Todos os clientes", desc: "Todos com cadastro na plataforma", icon: <Users className="h-4 w-4" /> },
    { value: "with_orders", label: "Clientes com pedidos", desc: "Quem já comprou pelo menos uma vez", icon: <ShoppingBag className="h-4 w-4" /> },
    { value: "without_orders", label: "Clientes sem pedidos", desc: "Cadastrados que ainda não compraram", icon: <UserCheck className="h-4 w-4" /> },
];

const TEMPLATE_LABELS: Record<string, { emoji: string; desc: string }> = {
    order_confirmed: { emoji: "✨", desc: "Enviado automaticamente ao confirmar um pedido" },
    order_shipped: { emoji: "📦", desc: "Enviado quando o pedido é despachado pelos Correios" },
    abandoned_cart: { emoji: "👀", desc: "Enviado para recuperar carrinhos abandonados há 2h+" },
};

function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("pt-BR", {
        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    });
}

function StatCard({ label, value, sub, icon, color }: {
    label: string; value: string | number; sub?: string;
    icon: React.ReactNode; color: string;
}) {
    return (
        <Card>
            <CardContent className="pt-5 pb-4">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">{label}</p>
                        <p className={`text-2xl font-bold ${color}`}>{value}</p>
                        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
                    </div>
                    <div className={`p-2 rounded-lg bg-muted/50 ${color}`}>{icon}</div>
                </div>
            </CardContent>
        </Card>
    );
}

// ─── Template editor sub-component ───────────────────────────────────────────

function TemplateEditor({ template }: { template: EmailTemplate }) {
    const [editing, setEditing] = useState(false);
    const [subject, setSubject] = useState(template.subject);
    const [html, setHtml] = useState(template.html);
    const [preview, setPreview] = useState(false);
    const update = useUpdateEmailTemplate();

    const meta = TEMPLATE_LABELS[template.id] ?? { emoji: "📧", desc: "" };

    const handleSave = () => {
        update.mutate({ id: template.id, subject, html }, {
            onSuccess: () => setEditing(false),
        });
    };

    const handleCancel = () => {
        setSubject(template.subject);
        setHtml(template.html);
        setEditing(false);
        setPreview(false);
    };

    return (
        <Card className="mb-4">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl">{meta.emoji}</span>
                        <div>
                            <CardTitle className="text-sm">{template.name}</CardTitle>
                            <p className="text-xs text-muted-foreground">{meta.desc}</p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        {editing && (
                            <>
                                <Button size="sm" variant="outline" onClick={() => setPreview(!preview)}>
                                    <Eye className="h-3.5 w-3.5 mr-1" />{preview ? "Fechar" : "Prévia"}
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancel}>
                                    <X className="h-3.5 w-3.5 mr-1" />Cancelar
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={update.isPending}>
                                    {update.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                                    Salvar
                                </Button>
                            </>
                        )}
                        {!editing && (
                            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                                <Edit3 className="h-3.5 w-3.5 mr-1" />Editar
                            </Button>
                        )}
                    </div>
                </div>
            </CardHeader>

            {editing && (
                <CardContent className="space-y-3 pt-0">
                    <div>
                        <Label className="text-xs">Assunto</Label>
                        <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="h-8 text-sm" />
                    </div>

                    {/* Variables hint */}
                    {template.variables?.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            <span className="text-xs text-muted-foreground mr-1">Variáveis:</span>
                            {template.variables.map((v) => (
                                <code key={v.key} className="text-xs bg-muted px-1.5 py-0.5 rounded text-accent cursor-pointer"
                                    onClick={() => setHtml((h) => h + `{{${v.key}}}`)}
                                    title={`Clique para inserir {{${v.key}}}`}
                                >
                                    {`{{${v.key}}}`}
                                </code>
                            ))}
                        </div>
                    )}

                    <div>
                        <Label className="text-xs">HTML do template</Label>
                        <Textarea
                            value={html}
                            onChange={(e) => setHtml(e.target.value)}
                            rows={10}
                            className="font-mono text-xs"
                        />
                    </div>

                    {preview && (
                        <div className="border rounded-lg overflow-hidden">
                            <p className="text-xs text-muted-foreground px-3 py-1.5 border-b">Pré-visualização</p>
                            <iframe
                                title="preview"
                                srcDoc={html}
                                className="w-full h-72 border-0"
                                sandbox="allow-same-origin"
                            />
                        </div>
                    )}
                </CardContent>
            )}

            {!editing && (
                <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                        Assunto: <span className="text-foreground">{template.subject}</span>
                        {template.updated_at && (
                            <span className="ml-3 opacity-60">· Editado em {formatDate(template.updated_at)}</span>
                        )}
                    </p>
                </CardContent>
            )}
        </Card>
    );
}

// ─── Mini bar chart (CSS only) ────────────────────────────────────────────────
function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="flex items-center gap-2 text-xs">
            <span className="w-24 truncate text-muted-foreground" title={label}>{label}</span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="w-8 text-right tabular-nums">{value}</span>
        </div>
    );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = "compose" | "templates" | "analytics";

const EmailMarketingPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>("compose");

    // ── Compose state ──
    const [subject, setSubject] = useState("");
    const [content, setContent] = useState("");
    const [ctaText, setCtaText] = useState("");
    const [ctaUrl, setCtaUrl] = useState("https://lepoa.online/catalogo");
    const [segment, setSegment] = useState<CampaignSegment>("all");
    const [showPreview, setShowPreview] = useState(false);

    // ── Hooks ──
    const { data: campaigns, isLoading: campaignsLoading } = useEmailCampaigns();
    const sendCampaign = useSendCampaign();
    const { data: templates, isLoading: templatesLoading } = useEmailTemplates();
    const { data: analytics, isLoading: analyticsLoading } = useEmailAnalytics();

    const previewHtml = useMemo(
        () => marketingBaseEmail({
            subject,
            content: content || "Conteúdo do email aparecerá aqui...",
            ctaText: ctaText || undefined,
            ctaUrl: ctaUrl || undefined,
        }),
        [subject, content, ctaText, ctaUrl]
    );

    const handleSend = () => {
        if (!subject.trim()) { alert("Preencha o assunto."); return; }
        if (!content.trim()) { alert("Preencha o conteúdo."); return; }
        const segLabel = SEGMENT_OPTIONS.find((s) => s.value === segment)?.label ?? segment;
        if (window.confirm(`Enviar campanha para o segmento "${segLabel}"?`)) {
            sendCampaign.mutate({ subject, content, segment, ctaText: ctaText || undefined, ctaUrl: ctaUrl || undefined });
        }
    };

    const TAB_CONFIG: { id: Tab; label: string; icon: React.ReactNode }[] = [
        { id: "compose", label: "Compor", icon: <Send className="h-4 w-4" /> },
        { id: "templates", label: "Templates", icon: <FileText className="h-4 w-4" /> },
        { id: "analytics", label: "Analytics", icon: <BarChart2 className="h-4 w-4" /> },
    ];

    return (
        <div className="min-h-screen bg-background">
            {/* Breadcrumb */}
            <div className="bg-foreground text-background px-4 py-2 text-xs flex items-center gap-2">
                <button onClick={() => navigate("/dashboard")} className="hover:underline opacity-70">Dashboard</button>
                <ChevronRight className="h-3 w-3 opacity-40" />
                <span>Email Marketing</span>
            </div>

            <main className="container mx-auto px-4 py-8 max-w-5xl">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2.5 rounded-lg bg-accent/10">
                        <Mail className="h-6 w-6 text-accent" />
                    </div>
                    <div>
                        <h1 className="font-serif text-2xl">Email Marketing</h1>
                        <p className="text-sm text-muted-foreground">Gerencie campanhas, templates e resultados</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-6 bg-muted/50 p-1 rounded-xl w-fit">
                    {TAB_CONFIG.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.id
                                    ? "bg-background shadow-sm text-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                                }`}
                        >
                            {tab.icon}{tab.label}
                        </button>
                    ))}
                </div>

                {/* ── TAB: COMPOSE ─────────────────────────────────────────────────── */}
                {activeTab === "compose" && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Send className="h-4 w-4" /> Compor campanha
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div>
                                        <Label htmlFor="em-subject">Assunto *</Label>
                                        <Input id="em-subject" placeholder="Ex: Novidades da Le.Poá 🌸" value={subject} onChange={(e) => setSubject(e.target.value)} />
                                    </div>
                                    <div>
                                        <Label htmlFor="em-content">Conteúdo *</Label>
                                        <Textarea id="em-content" placeholder={"Olá!\n\nEscreva aqui o conteúdo do email..."} rows={8} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-sm" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label htmlFor="em-cta-text">Texto do botão (opcional)</Label>
                                            <Input id="em-cta-text" placeholder="Ver coleção" value={ctaText} onChange={(e) => setCtaText(e.target.value)} />
                                        </div>
                                        <div>
                                            <Label htmlFor="em-cta-url">Link do botão</Label>
                                            <Input id="em-cta-url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} />
                                        </div>
                                    </div>

                                    {/* Segment */}
                                    <div>
                                        <Label className="mb-2 block">Segmento de envio *</Label>
                                        <RadioGroup value={segment} onValueChange={(v) => setSegment(v as CampaignSegment)} className="space-y-2">
                                            {SEGMENT_OPTIONS.map((opt) => (
                                                <label key={opt.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${segment === opt.value ? "border-accent bg-accent/5" : "border-border hover:bg-muted/50"}`}>
                                                    <RadioGroupItem value={opt.value} id={`seg-${opt.value}`} />
                                                    <span className="text-muted-foreground">{opt.icon}</span>
                                                    <div>
                                                        <p className="text-sm font-medium">{opt.label}</p>
                                                        <p className="text-xs text-muted-foreground">{opt.desc}</p>
                                                    </div>
                                                </label>
                                            ))}
                                        </RadioGroup>
                                    </div>

                                    <div className="flex gap-2 pt-2">
                                        <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
                                            <Eye className="h-4 w-4 mr-1.5" />{showPreview ? "Ocultar prévia" : "Pré-visualizar"}
                                        </Button>
                                        <Button onClick={handleSend} disabled={sendCampaign.isPending} className="ml-auto">
                                            {sendCampaign.isPending ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Enviando...</> : <><Send className="h-4 w-4 mr-1.5" />Enviar campanha</>}
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {showPreview && (
                                <Card>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm text-muted-foreground flex items-center gap-1.5">
                                            <Eye className="h-3.5 w-3.5" /> Pré-visualização
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <iframe title="Email preview" srcDoc={previewHtml} className="w-full rounded-b-lg border-0" style={{ height: "480px" }} sandbox="allow-same-origin" />
                                    </CardContent>
                                </Card>
                            )}
                        </div>

                        {/* Histórico */}
                        <div>
                            <Card className="sticky top-4">
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base flex items-center gap-2"><Clock className="h-4 w-4" />Histórico</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {campaignsLoading ? (
                                        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                                    ) : !campaigns?.length ? (
                                        <p className="text-sm text-muted-foreground text-center py-6">Nenhuma campanha enviada ainda.</p>
                                    ) : (
                                        <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                                            {campaigns.map((c) => (
                                                <div key={c.id} className="p-3 rounded-lg border border-border bg-muted/30 space-y-1">
                                                    <p className="text-sm font-medium truncate" title={c.subject}>{c.subject}</p>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <Badge variant="secondary" className="text-xs py-0">
                                                            {SEGMENT_OPTIONS.find((s) => s.value === c.segment)?.label ?? c.segment}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">{c.sent_count} enviados</span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">{formatDate(c.created_at)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                )}

                {/* ── TAB: TEMPLATES ───────────────────────────────────────────────── */}
                {activeTab === "templates" && (
                    <div>
                        <p className="text-sm text-muted-foreground mb-5">
                            Edite os templates de emails automáticos enviados pelo sistema. As alterações são aplicadas imediatamente nos próximos envios.
                        </p>
                        {templatesLoading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : !templates?.length ? (
                            <Card>
                                <CardContent className="pt-8 pb-8 text-center">
                                    <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                                    <p className="text-sm font-medium mb-1">Tabela não encontrada</p>
                                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                        Execute o SQL da <strong>Migração V2</strong> no Supabase para criar a tabela <code>email_templates</code> e carregar os templates padrão.
                                    </p>
                                </CardContent>
                            </Card>
                        ) : (
                            templates.map((t) => <TemplateEditor key={t.id} template={t} />)
                        )}
                    </div>
                )}

                {/* ── TAB: ANALYTICS ───────────────────────────────────────────────── */}
                {activeTab === "analytics" && (
                    <div className="space-y-6">
                        {analyticsLoading ? (
                            <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                        ) : !analytics ? (
                            <p className="text-sm text-muted-foreground">Nenhum dado disponível.</p>
                        ) : (
                            <>
                                {/* Summary cards */}
                                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                    <StatCard label="Total enviados" value={analytics.totalSent} icon={<Send className="h-4 w-4" />} color="text-foreground" />
                                    <StatCard label="Aberturas" value={analytics.totalOpens} sub={`${analytics.avgOpenRate}% taxa média`} icon={<MailOpen className="h-4 w-4" />} color="text-blue-600" />
                                    <StatCard label="Cliques" value={analytics.totalClicks} icon={<MousePointerClick className="h-4 w-4" />} color="text-green-600" />
                                    <StatCard label="Campanhas" value={analytics.campaigns.length} icon={<TrendingUp className="h-4 w-4" />} color="text-accent" />
                                </div>

                                {/* Bar chart: sent per campaign */}
                                {analytics.campaigns.length > 0 && (
                                    <Card>
                                        <CardHeader className="pb-3">
                                            <CardTitle className="text-sm flex items-center gap-2"><BarChart2 className="h-4 w-4" />Emails enviados por campanha</CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {analytics.campaigns.slice(0, 10).map((c) => (
                                                <MiniBar key={c.id} value={c.sent_count} max={Math.max(...analytics.campaigns.map((x) => x.sent_count))} label={c.subject} />
                                            ))}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Detailed table */}
                                <Card>
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Histórico de campanhas</CardTitle>
                                    </CardHeader>
                                    <CardContent className="p-0">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="border-b bg-muted/30">
                                                        <th className="text-left px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">Campanha</th>
                                                        <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">Segmento</th>
                                                        <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">Enviados</th>
                                                        <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">Aberturas</th>
                                                        <th className="text-center px-3 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">Cliques</th>
                                                        <th className="text-right px-4 py-2.5 font-medium text-xs text-muted-foreground uppercase tracking-wide">Data</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {analytics.campaigns.map((c) => (
                                                        <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                                                            <td className="px-4 py-3 max-w-[220px] truncate" title={c.subject}>{c.subject}</td>
                                                            <td className="px-3 py-3 text-center">
                                                                <Badge variant="secondary" className="text-xs py-0">
                                                                    {SEGMENT_OPTIONS.find((s) => s.value === c.segment)?.label ?? c.segment}
                                                                </Badge>
                                                            </td>
                                                            <td className="px-3 py-3 text-center tabular-nums">{c.sent_count}</td>
                                                            <td className="px-3 py-3 text-center">
                                                                {c.opens > 0 ? (
                                                                    <span className="text-blue-600 font-medium">{c.opens} <span className="text-xs text-muted-foreground">({c.open_rate}%)</span></span>
                                                                ) : <span className="text-muted-foreground text-xs">—</span>}
                                                            </td>
                                                            <td className="px-3 py-3 text-center">
                                                                {c.clicks > 0 ? (
                                                                    <span className="text-green-600 font-medium">{c.clicks} <span className="text-xs text-muted-foreground">({c.click_rate}%)</span></span>
                                                                ) : <span className="text-muted-foreground text-xs">—</span>}
                                                            </td>
                                                            <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.created_at)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </CardContent>
                                </Card>
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
};

export default EmailMarketingPage;
