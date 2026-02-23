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
  { value: "post_sale", label: "Pos-venda" },
  { value: "vip", label: "VIP" },
  { value: "preventive", label: "Preventivo" },
  { value: "reactivation", label: "Reativacao" },
  { value: "channel_migration", label: "Migracao de canal" },
];

const CHANNELS = [
  { value: "site", label: "Site", emoji: "S" },
  { value: "live", label: "Live", emoji: "L" },
  { value: "hybrid", label: "Hibrido", emoji: "H" },
  { value: "general", label: "Geral (fallback)", emoji: "G" },
];

export function RFVTemplateManager({ templates, onSave }: Props) {
  const [activeType, setActiveType] = useState(TASK_TYPES[0].value);
  const [isSaving, setIsSaving] = useState(false);
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
            Editor de mensagens do Copiloto
          </CardTitle>
          <CardDescription>
            Personalize as mensagens sugeridas. Use <code className="bg-slate-100 px-1 rounded">{"{{name}}"}</code> para o nome da cliente.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs value={activeType} onValueChange={setActiveType} className="space-y-6">
            <TabsList className="bg-slate-50 flex-wrap h-auto p-1">
              {TASK_TYPES.map((type) => (
                <TabsTrigger key={type.value} value={type.value} className="text-xs">
                  {type.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {TASK_TYPES.map((type) => (
              <TabsContent key={type.value} value={type.value} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {CHANNELS.map((channel) => {
                    const template = templates.find(
                      (item) => item.task_type === type.value && item.channel_context === channel.value
                    );
                    const currentValue =
                      editingContent[`${type.value}_${channel.value}`] ?? template?.content ?? "";

                    return (
                      <Card key={channel.value} className="border-slate-100 shadow-none">
                        <CardContent className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="gap-1">
                              {channel.emoji} {channel.label}
                            </Badge>
                            {template && <span className="text-[10px] text-muted-foreground italic">Salvo</span>}
                          </div>

                          <Textarea
                            value={currentValue}
                            onChange={(event) =>
                              setEditingContent((prev) => ({
                                ...prev,
                                [`${type.value}_${channel.value}`]: event.target.value,
                              }))
                            }
                            placeholder="Escreva a mensagem aqui..."
                            className="text-sm min-h-[100px] bg-slate-50/30"
                          />

                          <Button
                            size="sm"
                            className="w-full bg-slate-800 text-white hover:bg-slate-900"
                            onClick={() => handleSave(channel.value)}
                            disabled={isSaving || currentValue === (template?.content ?? "")}
                          >
                            Salvar template
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
            Se nao existir template especifico do canal, o sistema usa automaticamente o template de fallback
            ({" "}
            <strong>Geral</strong>).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

