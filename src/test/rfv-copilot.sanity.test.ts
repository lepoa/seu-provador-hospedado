import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

function getServiceClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) return null;

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function runId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

function fakePhone(seed: string): string {
  const digits = seed.replace(/\D/g, "").slice(0, 10).padEnd(10, "7");
  return `55${digits}`;
}

function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString();
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

async function createCustomer(supabase: SupabaseClient, seed: string): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: `RFV ${seed}`,
      phone: fakePhone(seed),
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();
  return data!.id as string;
}

async function createPaidOrder(
  supabase: SupabaseClient,
  params: {
    customerId: string;
    seed: string;
    daysAgo: number;
    total?: number;
    source?: string;
  }
): Promise<string> {
  const paidAt = isoDaysAgo(params.daysAgo);

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_id: params.customerId,
      customer_name: `RFV ${params.seed}`,
      customer_phone: fakePhone(params.seed),
      customer_address: "Rua Teste, 123",
      total: params.total ?? 100,
      source: params.source ?? "catalog",
      status: "pago",
      payment_status: "approved",
      paid_at: paidAt,
      created_at: paidAt,
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();
  return data!.id as string;
}

async function runCopilot(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("run_rfv_copilot");
  expect(error).toBeNull();
  expect(data).toBeTruthy();
}

async function cleanupCustomerData(supabase: SupabaseClient, customerId: string) {
  await supabase.from("rfv_tasks").delete().eq("customer_id", customerId);
  await supabase.from("customer_rfv_metrics").delete().eq("customer_id", customerId);
  await supabase.from("rfv_daily").delete().eq("customer_id", customerId);
  await supabase.from("orders").delete().eq("customer_id", customerId);
  await supabase.from("customers").delete().eq("id", customerId);
}

describe("rfv regression: copiloto", () => {
  it("cliente com ciclo de 30 dias gera tarefa preventiva no dia 21", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-preventive");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 111 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 81 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 51 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 21 });

      await runCopilot(supabase);

      const { data, error } = await supabase
        .from("rfv_tasks")
        .select("task_type,priority")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate())
        .eq("task_type", "preventivo");

      expect(error).toBeNull();
      expect((data || []).length).toBeGreaterThan(0);
      expect(data?.[0]?.priority).toBe("importante");
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("cliente com compra ontem nao gera tarefa operacional", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-yesterday");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 31 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 1 });

      await runCopilot(supabase);

      const { data, error } = await supabase
        .from("rfv_tasks")
        .select("id")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate())
        .in("task_type", ["pos_compra", "preventivo", "reativacao", "vip"]);

      expect(error).toBeNull();
      expect((data || []).length).toBe(0);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("rodar motor 2x no mesmo dia nao duplica tarefas", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-idempotent");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 111 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 81 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 51 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 21 });

      await runCopilot(supabase);
      await runCopilot(supabase);

      const { data, error } = await supabase
        .from("rfv_tasks")
        .select("task_type")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate());

      expect(error).toBeNull();
      const taskTypes = (data || []).map((row) => row.task_type);
      const uniqueTaskTypes = new Set(taskTypes);
      expect(taskTypes.length).toBe(uniqueTaskTypes.size);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("marcar check registra usuario e horario", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-check");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 111 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 81 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 51 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 21 });

      await runCopilot(supabase);

      const { data: task, error: taskError } = await supabase
        .from("rfv_tasks")
        .select("id")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate())
        .eq("status", "pendente")
        .limit(1)
        .single();

      expect(taskError).toBeNull();
      const taskId = task?.id as string;
      expect(taskId).toBeTruthy();

      const checkedAt = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("rfv_tasks")
        .update({
          status: "enviado",
          executed_by: "rfv-regression-test",
          executed_at: checkedAt,
        })
        .eq("id", taskId);

      expect(updateError).toBeNull();

      const { data: updatedTask, error: readError } = await supabase
        .from("rfv_tasks")
        .select("status,executed_by,executed_at")
        .eq("id", taskId)
        .single();

      expect(readError).toBeNull();
      expect(updatedTask?.status).toBe("enviado");
      expect(updatedTask?.executed_by).toBe("rfv-regression-test");
      expect(updatedTask?.executed_at).toBeTruthy();
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("nova venda apos tarefa enviada gera atribuicao de receita", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-revenue");
    let customerId: string | undefined;
    let convertedOrderId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 111 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 81 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 51 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 21 });

      await runCopilot(supabase);

      const { data: task, error: taskError } = await supabase
        .from("rfv_tasks")
        .select("id")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate())
        .eq("task_type", "preventivo")
        .limit(1)
        .single();

      expect(taskError).toBeNull();
      const taskId = task?.id as string;
      expect(taskId).toBeTruthy();

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabase
        .from("rfv_tasks")
        .update({
          status: "enviado",
          executed_by: "rfv-regression-test",
          executed_at: oneHourAgo,
        })
        .eq("id", taskId);

      expect(updateError).toBeNull();

      convertedOrderId = await createPaidOrder(supabase, {
        customerId,
        seed,
        daysAgo: 0,
        total: 123,
      });

      const { error: attrError } = await supabase.rpc("attribute_rfv_revenue");
      expect(attrError).toBeNull();

      const { data: convertedTask, error: readError } = await supabase
        .from("rfv_tasks")
        .select("status,revenue_generated,converted_order_id")
        .eq("id", taskId)
        .single();

      expect(readError).toBeNull();
      expect(convertedTask?.status).toBe("converteu");
      expect(Number(convertedTask?.revenue_generated || 0)).toBeGreaterThanOrEqual(123);
      expect(convertedTask?.converted_order_id).toBe(convertedOrderId);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);
});
