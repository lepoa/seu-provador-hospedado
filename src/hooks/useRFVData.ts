import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DB_STATUS_BY_UI: Record<string, string> = {
  todo: "pendente",
  sent: "enviado",
  replied: "respondeu",
  won: "converteu",
  no_reply: "sem_resposta",
  skipped: "skipped",
};

const UI_STATUS_BY_DB: Record<string, string> = {
  pendente: "todo",
  enviado: "sent",
  respondeu: "replied",
  converteu: "won",
  sem_resposta: "no_reply",
  skipped: "skipped",
};

const UI_PRIORITY_BY_DB: Record<string, string> = {
  critico: "critical",
  importante: "high",
  oportunidade: "medium",
  critical: "critical",
  high: "high",
  medium: "medium",
  low: "low",
};

const DB_PRIORITY_BY_UI: Record<string, string> = {
  critical: "critico",
  high: "importante",
  medium: "oportunidade",
  low: "oportunidade",
};

const UI_TASK_TYPE_BY_DB: Record<string, string> = {
  pos_compra: "post_sale",
  preventivo: "preventive",
  reativacao: "reactivation",
  vip: "vip",
  perda_frequencia: "frequency_drop",
  migrar_canal: "channel_migration",
  post_sale: "post_sale",
  preventive: "preventive",
  reactivation: "reactivation",
  channel_migration: "channel_migration",
};

const DB_TASK_TYPE_BY_UI: Record<string, string> = {
  post_sale: "pos_compra",
  preventive: "preventivo",
  reactivation: "reativacao",
  vip: "vip",
  frequency_drop: "perda_frequencia",
  channel_migration: "migrar_canal",
};

const UI_CHANNEL_BY_DB: Record<string, string> = {
  live_only: "live",
  site_only: "site",
  hybrid: "hybrid",
  all: "general",
  live: "live",
  site: "site",
  general: "general",
};

const DB_CHANNEL_BY_UI: Record<string, string> = {
  live: "live_only",
  site: "site_only",
  hybrid: "hybrid",
  general: "all",
};

function normalizeStatus(value: string | null | undefined): string {
  if (!value) return "todo";
  return UI_STATUS_BY_DB[value] || value;
}

function toDbStatus(value: string): string {
  return DB_STATUS_BY_UI[value] || value;
}

function normalizePriority(value: string | null | undefined): string {
  if (!value) return "medium";
  return UI_PRIORITY_BY_DB[value] || "medium";
}

function normalizeTaskType(value: string | null | undefined): string {
  if (!value) return "preventive";
  return UI_TASK_TYPE_BY_DB[value] || value;
}

function toDbTaskType(value: string): string {
  return DB_TASK_TYPE_BY_UI[value] || value;
}

function normalizeChannel(value: string | null | undefined): string {
  if (!value) return "site";
  return UI_CHANNEL_BY_DB[value] || value;
}

function toDbChannel(value: string): string {
  return DB_CHANNEL_BY_UI[value] || value;
}

function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

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
  customer_name?: string;
  customer_phone?: string;
  rfv_segment?: string;
  repurchase_probability_score?: number;
  recency_days?: number;
  cycle_mean_days?: number | null;
  adherence_ratio?: number | null;
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
  criticalToday: number;
  idealWindowToday: number;
  postSalesToday: number;
  potentialRevenue7d: number;
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
      const { data: metricsData, error: metricsError } = await supabase
        .from("customer_rfv_metrics")
        .select("*, customer:customers(name, phone, phone_e164)")
        .order("monetary_value", { ascending: false });

      if (metricsError) throw metricsError;

      const enrichedMetrics = (metricsData || []).map((m: any) => ({
        ...m,
        purchase_channel: normalizeChannel(m.purchase_channel),
        customer_name: m.customer?.name || "Sem nome",
        customer_phone: m.customer?.phone_e164 || m.customer?.phone || "",
      }));
      setMetrics(enrichedMetrics);

      const metricByCustomerId = new Map<string, RFVMetrics>();
      enrichedMetrics.forEach((item: RFVMetrics) => metricByCustomerId.set(item.customer_id, item));

      const { data: tasksData, error: tasksError } = await supabase
        .from("rfv_tasks")
        .select("*, customer:customers(name, phone, phone_e164)")
        .in("status", ["pendente", "enviado", "respondeu", "converteu", "sem_resposta", "skipped"])
        .order("created_at", { ascending: false })
        .limit(400);

      if (tasksError) throw tasksError;

      const enrichedTasks = (tasksData || []).map((t: any) => {
        const customerMetric = metricByCustomerId.get(t.customer_id);
        const recencyDays = customerMetric?.recency_days;
        const cycleMeanDays = customerMetric?.individual_cycle_avg_days ?? customerMetric?.avg_cycle_days ?? null;
        const adherenceRatio =
          recencyDays !== undefined && cycleMeanDays && cycleMeanDays > 0
            ? recencyDays / cycleMeanDays
            : null;

        return {
          ...t,
          task_type: normalizeTaskType(t.task_type),
          priority: normalizePriority(t.priority),
          status: normalizeStatus(t.status),
          channel_context: normalizeChannel(t.channel_context),
          estimated_impact: Number(t.estimated_impact || 0),
          revenue_generated: Number(t.revenue_generated || 0),
          customer_name: t.customer?.name || "Sem nome",
          customer_phone: t.customer?.phone_e164 || t.customer?.phone || "",
          rfv_segment: customerMetric?.rfv_segment || "novo",
          repurchase_probability_score:
            Number(customerMetric?.repurchase_probability_score || t.repurchase_probability_score || 0),
          recency_days: recencyDays,
          cycle_mean_days: cycleMeanDays,
          adherence_ratio: adherenceRatio,
        } as RFVTask;
      });

      const statusRank: Record<string, number> = {
        todo: 0,
        sent: 1,
        replied: 2,
        won: 3,
        no_reply: 4,
        skipped: 5,
      };

      enrichedTasks.sort((a, b) => {
        const rankDiff = (statusRank[a.status] ?? 99) - (statusRank[b.status] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        const impactDiff = (b.estimated_impact || 0) - (a.estimated_impact || 0);
        if (impactDiff !== 0) return impactDiff;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });

      setTasks(enrichedTasks);

      if (enrichedMetrics.length > 0) {
        const segDist: Record<string, number> = {};
        const chDist: Record<string, number> = {};

        enrichedMetrics.forEach((m: RFVMetrics) => {
          segDist[m.rfv_segment] = (segDist[m.rfv_segment] || 0) + 1;
          chDist[m.purchase_channel] = (chDist[m.purchase_channel] || 0) + 1;
        });

        const { data: recentTasks } = await supabase
          .from("rfv_tasks")
          .select("status,created_at,revenue_generated")
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

        const normalizedRecentTasks = (recentTasks || []).map((task: any) => ({
          ...task,
          status: normalizeStatus(task.status),
          revenue_generated: Number(task.revenue_generated || 0),
        }));

        const total = normalizedRecentTasks.length || 1;
        const executed = normalizedRecentTasks.filter((t: any) => t.status !== "todo").length;
        const responded = normalizedRecentTasks.filter((t: any) => ["replied", "won"].includes(t.status)).length;
        const converted = normalizedRecentTasks.filter((t: any) => t.status === "won").length;

        const totalRevenue = normalizedRecentTasks
          .filter((t: any) => t.status === "won")
          .reduce((sum: number, t: any) => sum + (Number(t.revenue_generated) || 0), 0);

        const avgCycles = enrichedMetrics
          .filter((m: RFVMetrics) => m.avg_cycle_days !== null)
          .map((m: RFVMetrics) => m.avg_cycle_days as number);

        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const plusSeven = new Date(today);
        plusSeven.setDate(plusSeven.getDate() + 7);

        const criticalToday = enrichedTasks.filter(
          (t: RFVTask) => t.status === "todo" && t.priority === "critical"
        ).length;

        const postSalesToday = enrichedTasks.filter(
          (t: RFVTask) =>
            t.status === "todo" &&
            t.task_type === "post_sale" &&
            isoDate(t.created_at) === todayStr
        ).length;

        const idealWindowToday = enrichedMetrics.filter((m: RFVMetrics) => {
          const start = isoDate(m.ideal_contact_start);
          const end = isoDate(m.ideal_contact_end);
          if (!start || !end) return false;
          return todayStr >= start && todayStr <= end;
        }).length;

        const potentialRevenue7d = enrichedTasks
          .filter((t: RFVTask) => {
            if (t.status !== "todo") return false;
            if (!t.expires_at) return true;
            const exp = new Date(t.expires_at);
            return !Number.isNaN(exp.getTime()) && exp <= plusSeven;
          })
          .reduce((sum: number, t: RFVTask) => sum + (t.estimated_impact || 0), 0);

        const todayTasks = enrichedTasks.filter((t: RFVTask) => isoDate(t.created_at) === todayStr);

        setSummary({
          totalCustomers: enrichedMetrics.length,
          segmentDistribution: segDist,
          channelDistribution: chDist,
          avgRecurrency:
            avgCycles.length > 0
              ? avgCycles.reduce((a: number, b: number) => a + b, 0) / avgCycles.length
              : 0,
          avgTicket:
            enrichedMetrics.reduce((s: number, m: RFVMetrics) => s + m.avg_ticket, 0) /
            enrichedMetrics.length,
          pendingTasks: enrichedTasks.filter((t: RFVTask) => t.status === "todo").length,
          tasksByPriority: enrichedTasks.reduce((acc: Record<string, number>, t: RFVTask) => {
            if (t.status === "todo") acc[t.priority] = (acc[t.priority] || 0) + 1;
            return acc;
          }, {}),
          executionRate: (executed / total) * 100,
          responseRate: (responded / total) * 100,
          conversionRate: (converted / total) * 100,
          dailyTaskGoal: todayTasks.length,
          dailyTaskDone: todayTasks.filter((t: RFVTask) => t.status !== "todo").length,
          totalRevenue,
          roi: totalRevenue > 0 ? totalRevenue / (normalizedRecentTasks.length || 1) : 0,
          criticalToday,
          idealWindowToday,
          postSalesToday,
          potentialRevenue7d,
        });
      }

      const { data: templatesData } = await supabase.from("rfv_templates").select("*");
      if (templatesData) {
        setTemplates(
          templatesData.map((template: any) => ({
            ...template,
            task_type: normalizeTaskType(template.task_type),
            channel_context: normalizeChannel(template.channel_context),
          }))
        );
      }
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

      await supabase.rpc("attribute_rfv_revenue");

      toast.success(
        `Copiloto atualizado! ${(data as any)?.metrics?.customers_calculated || 0} clientes, ${(data as any)?.tasks?.tasks_created || 0} tarefas`
      );
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
      const dbStatus = toDbStatus(newStatus);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const actor = user?.id || "sistema";
      const now = new Date().toISOString();
      const isPending = newStatus === "todo";

      const { error } = await supabase
        .from("rfv_tasks")
        .update({
          status: dbStatus,
          executed_at: isPending ? null : now,
          executed_by: isPending ? null : actor,
        })
        .eq("id", taskId);

      if (error) throw error;

      if (newStatus === "won") {
        await supabase.rpc("attribute_rfv_revenue");
      }

      setTasks((prev) =>
        prev.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: newStatus,
                executed_at: isPending ? null : now,
                executed_by: isPending ? null : actor,
              }
            : task
        )
      );

      toast.success("Status atualizado");
      await loadData();
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + (err.message || ""));
    }
  };

  const saveTemplate = async (taskType: string, channel: string, content: string) => {
    try {
      const { error } = await supabase.from("rfv_templates").upsert(
        {
          task_type: toDbTaskType(taskType),
          channel_context: toDbChannel(channel),
          content,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "task_type,channel_context" }
      );

      if (error) throw error;

      const { data } = await supabase.from("rfv_templates").select("*");
      if (data) {
        setTemplates(
          data.map((template: any) => ({
            ...template,
            task_type: normalizeTaskType(template.task_type),
            channel_context: normalizeChannel(template.channel_context),
          }))
        );
      }

      toast.success("Template salvo com sucesso");
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

