import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface RFVMetrics {
    customer_id: string;
    recency_days: number;
    frequency: number;
    monetary_value: number;
    avg_ticket: number;
    avg_cycle_days: number | null;
    repurchase_probability: number;
    r_score: number;
    f_score: number;
    v_score: number;
    rfv_segment: string;
    churn_risk: string;
    purchase_channel: string;
    live_order_count: number;
    site_order_count: number;
    live_total: number;
    site_total: number;
    preferred_channel: string;
    last_purchase_at: string;
    first_purchase_at: string;
    ideal_contact_start: string | null;
    ideal_contact_end: string | null;
    calculated_at: string;
    individual_cycle_avg_days: number | null;
    individual_cycle_std_dev: number | null;
    cycle_deviation_percent: number | null;
    repurchase_probability_score: number;
    // joined customer name
    customer_name?: string;
    customer_phone?: string;
}

export interface RFVTask {
    id: string;
    customer_id: string;
    task_type: string;
    priority: string;
    reason: string;
    suggested_message: string;
    objective: string;
    channel_context: string;
    estimated_impact: number;
    status: string;
    created_at: string;
    executed_at: string | null;
    executed_by: string | null;
    expires_at: string | null;
    revenue_generated: number;
    converted_order_id: string | null;
    conversion_timestamp: string | null;
    automation_eligible: boolean;
    automation_sent: boolean;
    // joined
    customer_name?: string;
    customer_phone?: string;
    rfv_segment?: string;
    repurchase_probability_score?: number;
}

export interface RFVSummary {
    totalCustomers: number;
    segmentDistribution: Record<string, number>;
    channelDistribution: Record<string, number>;
    avgRecurrency: number;
    avgTicket: number;
    pendingTasks: number;
    tasksByPriority: Record<string, number>;
    executionRate: number;
    responseRate: number;
    conversionRate: number;
    dailyTaskGoal: number;
    dailyTaskDone: number;
    totalRevenue: number;
    roi: number;
}

export interface RFVTemplate {
    id: string;
    task_type: string;
    channel_context: string;
    content: string;
}

export function useRFVData() {
    const [metrics, setMetrics] = useState<RFVMetrics[]>([]);
    const [tasks, setTasks] = useState<RFVTask[]>([]);
    const [summary, setSummary] = useState<RFVSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [templates, setTemplates] = useState<RFVTemplate[]>([]);

    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load metrics with customer names
            const { data: metricsData, error: metricsError } = await supabase
                .from("customer_rfv_metrics")
                .select("*, customer:customers(name, phone)")
                .order("monetary_value", { ascending: false });

            if (metricsError) throw metricsError;

            const enrichedMetrics = (metricsData || []).map((m: any) => ({
                ...m,
                customer_name: m.customer?.name || "Sem nome",
                customer_phone: m.customer?.phone || "",
            }));
            setMetrics(enrichedMetrics);

            // Load today's tasks (and recent pending)
            const { data: tasksData, error: tasksError } = await supabase
                .from("rfv_tasks")
                .select("*, customer:customers(name, phone)")
                .in("status", ["pendente", "enviado"])
                .order("created_at", { ascending: false })
                .limit(200);

            if (tasksError) throw tasksError;

            const enrichedTasks = (tasksData || []).map((t: any) => {
                // Find matching metrics for segment
                const customerMetric = enrichedMetrics.find((m: RFVMetrics) => m.customer_id === t.customer_id);
                return {
                    ...t,
                    customer_name: t.customer?.name || "Sem nome",
                    customer_phone: t.customer?.phone || "",
                    rfv_segment: customerMetric?.rfv_segment || "novo",
                };
            });
            setTasks(enrichedTasks);

            // Calculate summary
            if (enrichedMetrics.length > 0) {
                const segDist: Record<string, number> = {};
                const chDist: Record<string, number> = {};
                enrichedMetrics.forEach((m: RFVMetrics) => {
                    segDist[m.rfv_segment] = (segDist[m.rfv_segment] || 0) + 1;
                    chDist[m.purchase_channel] = (chDist[m.purchase_channel] || 0) + 1;
                });

                // Task execution stats (last 30 days)
                const { data: recentTasks } = await supabase
                    .from("rfv_tasks")
                    .select("status")
                    .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

                const allRecentTasks = recentTasks || [];
                const total = allRecentTasks.length || 1;
                const executed = allRecentTasks.filter((t: any) => t.status !== "pendente").length;
                const responded = allRecentTasks.filter((t: any) => ["respondeu", "converteu"].includes(t.status)).length;
                const converted = allRecentTasks.filter((t: any) => t.status === "converteu").length;

                const totalRevenue = allRecentTasks
                    .filter((t: any) => t.status === "converteu")
                    .reduce((sum: number, t: any) => sum + (Number(t.revenue_generated) || 0), 0);

                const avgCycles = enrichedMetrics
                    .filter((m: RFVMetrics) => m.avg_cycle_days !== null)
                    .map((m: RFVMetrics) => m.avg_cycle_days!);

                setSummary({
                    totalCustomers: enrichedMetrics.length,
                    segmentDistribution: segDist,
                    channelDistribution: chDist,
                    avgRecurrency: avgCycles.length > 0 ? avgCycles.reduce((a: number, b: number) => a + b, 0) / avgCycles.length : 0,
                    avgTicket: enrichedMetrics.reduce((s: number, m: RFVMetrics) => s + m.avg_ticket, 0) / enrichedMetrics.length,
                    pendingTasks: enrichedTasks.filter((t: RFVTask) => t.status === "pendente").length,
                    tasksByPriority: enrichedTasks.reduce((acc: Record<string, number>, t: RFVTask) => {
                        if (t.status === "pendente") acc[t.priority] = (acc[t.priority] || 0) + 1;
                        return acc;
                    }, {}),
                    executionRate: (executed / total) * 100,
                    responseRate: (responded / total) * 100,
                    conversionRate: (converted / total) * 100,
                    dailyTaskGoal: allRecentTasks.filter((t: any) =>
                        t.created_at && t.created_at.startsWith(new Date().toISOString().split('T')[0])
                    ).length,
                    dailyTaskDone: allRecentTasks.filter((t: any) =>
                        t.created_at && t.created_at.startsWith(new Date().toISOString().split('T')[0]) && t.status !== 'pendente'
                    ).length,
                    totalRevenue,
                    roi: totalRevenue > 0 ? (totalRevenue / (allRecentTasks.length || 1)) : 0,
                });
            }

            // Load templates
            const { data: templatesData } = await supabase.from("rfv_templates").select("*");
            if (templatesData) setTemplates(templatesData);
        } catch (err: any) {
            console.error("Error loading RFV data:", err);
            toast.error("Erro ao carregar dados RFV");
        } finally {
            setIsLoading(false);
        }
    }, []);

    const recalculate = async () => {
        setIsRecalculating(true);
        try {
            const { data, error } = await supabase.rpc("run_rfv_copilot");
            if (error) throw error;

            // Atribuir receita logo após o cálculo
            await supabase.rpc("attribute_rfv_revenue");

            toast.success(`RFV recalculado! ${(data as any)?.metrics?.customers_calculated || 0} clientes, ${(data as any)?.tasks?.tasks_created || 0} tarefas`);
            await loadData();
        } catch (err: any) {
            console.error("Error recalculating RFV:", err);
            toast.error("Erro ao recalcular: " + (err.message || ""));
        } finally {
            setIsRecalculating(false);
        }
    };

    const updateTaskStatus = async (taskId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from("rfv_tasks")
                .update({
                    status: newStatus,
                    executed_at: newStatus !== "pendente" ? new Date().toISOString() : null,
                    executed_by: newStatus !== "pendente" ? "admin" : null,
                })
                .eq("id", taskId);

            if (error) throw error;

            setTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, status: newStatus, executed_at: new Date().toISOString() } : t))
            );
            toast.success("Status atualizado!");
        } catch (err: any) {
            toast.error("Erro ao atualizar: " + (err.message || ""));
        }
    };

    const saveTemplate = async (taskType: string, channel: string, content: string) => {
        try {
            const { error } = await supabase
                .from("rfv_templates")
                .upsert({
                    task_type: taskType,
                    channel_context: channel,
                    content,
                    updated_at: new Date().toISOString(),
                }, { onConflict: 'task_type,channel_context' });

            if (error) throw error;

            // Refresh templates local state
            const { data } = await supabase.from("rfv_templates").select("*");
            if (data) setTemplates(data);

            toast.success("Template salvo com sucesso!");
        } catch (err: any) {
            toast.error("Erro ao salvar template: " + (err.message || ""));
        }
    };

    useEffect(() => {
        loadData();
    }, [loadData]);

    return {
        metrics,
        tasks,
        summary,
        isLoading,
        isRecalculating,
        recalculate,
        updateTaskStatus,
        saveTemplate,
        templates,
        reload: loadData,
    };
}
