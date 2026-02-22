import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Save, Info } from "lucide-react";
import type { RFVTemplate } from "@/hooks/useRFVData";

interface Props {
    templates: RFVTemplate[];
    onSave: (type: string, channel: string, content: string) => Promise<void>;
}

const TASK_TYPES = [
    { value: "pos_compra", label: "Pós-compra" },
    { value: "vip", label: "VIP (Campeões)" },
    { value: "preventivo", label: "Preventivo" },
    { value: "reativacao", label: "Reativação" },
    { value: "migrar_canal", label: "Migração de Canal" },
];

const CHANNELS = [
    { value: "site_only", label: "Site Only", emoji: "🛒" },
    { value: "live_only", label: "Live Only", emoji: "🎥" },
    { value: "hybrid", label: "Híbrido", emoji: "🔀" },
    { value: "all", label: "Geral (Fallback)", emoji: "🌍" },
];

export function RFVTemplateManager({ templates, onSave }: Props) {
    const [activeType, setActiveType] = useState(TASK_TYPES[0].value);
    const [isSaving, setIsSaving] = useState(false);

    // Local state for edits
    const [editingContent, setEditingContent] = useState<Record<string, string>>({});

    const handleSave = async (channel: string) => {
        const content = editingContent[`${activeType}_${channel}`];
        if (content === undefined) return;

        setIsSaving(true);
        await onSave(activeType, channel, content);
        setIsSaving(false);
    };

    return (
        <div className="space-y-6">
            <Card className="border-purple-100">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Save className="h-5 w-5 text-purple-600" />
                        Editor de Mensagens do Copiloto
                    </CardTitle>
                    <CardDescription>
                        Personalize o que o Copiloto sugere para cada situação. Use <code className="bg-slate-100 px-1 rounded">{"{{name}}"}</code> para o nome do cliente.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeType} onValueChange={setActiveType} className="space-y-6">
                        <TabsList className="bg-slate-50 flex-wrap h-auto p-1">
                            {TASK_TYPES.map((t) => (
                                <TabsTrigger key={t.value} value={t.value} className="text-xs">
                                    {t.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>

                        {TASK_TYPES.map((t) => (
                            <TabsContent key={t.value} value={t.value} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {CHANNELS.map((ch) => {
                                        const template = templates.find(temp => temp.task_type === t.value && temp.channel_context === ch.value);
                                        const currentVal = editingContent[`${t.value}_${ch.value}`] ?? template?.content ?? "";

                                        return (
                                            <Card key={ch.value} className="border-slate-100 shadow-none">
                                                <CardContent className="p-4 space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <Badge variant="outline" className="gap-1">
                                                            {ch.emoji} {ch.label}
                                                        </Badge>
                                                        {template && <span className="text-[10px] text-muted-foreground italic">Salvo</span>}
                                                    </div>

                                                    <Textarea
                                                        value={currentVal}
                                                        onChange={(e) => setEditingContent(prev => ({ ...prev, [`${t.value}_${ch.value}`]: e.target.value }))}
                                                        placeholder="Escreva a mensagem aqui..."
                                                        className="text-sm min-h-[100px] bg-slate-50/30"
                                                    />

                                                    <Button
                                                        size="sm"
                                                        className="w-full bg-slate-800 text-white hover:bg-slate-900"
                                                        onClick={() => handleSave(ch.value)}
                                                        disabled={isSaving || currentVal === (template?.content ?? "")}
                                                    >
                                                        Salvar Template
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            </TabsContent>
                        ))}
                    </Tabs>
                </CardContent>
            </Card>

            <Card className="bg-blue-50/50 border-blue-100">
                <CardContent className="p-4 flex gap-3 text-sm text-blue-700">
                    <Info className="h-5 w-5 shrink-0" />
                    <p>
                        <strong>Dica:</strong> Se você não definir um template para um canal específico (ex: Live Only),
                        o sistema usará automaticamente o template marcado como <strong>Geral (Fallback)</strong>.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
