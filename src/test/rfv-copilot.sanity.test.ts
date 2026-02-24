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
    daysAgo?: number;
    paidAtIso?: string;
    total?: number;
    source?: string;
  }
): Promise<string> {
  const paidAt = params.paidAtIso ?? isoDaysAgo(params.daysAgo ?? 0);

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
  it("pos-venda D+3 gera 1 tarefa e nao duplica", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-postsale");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 63 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 33 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 3 });

      await runCopilot(supabase);
      await runCopilot(supabase);

      const { data, error } = await supabase
        .from("rfv_tasks")
        .select("task_type,priority")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate());

      expect(error).toBeNull();
      expect((data || []).length).toBe(1);
      expect(data?.[0]?.task_type).toBe("pos_compra");
      expect(data?.[0]?.priority).toBe("oportunidade");
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("preventivo (70%-100% do ciclo) gera tarefa preventive", async () => {
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
        .eq("task_date", todayIsoDate());

      expect(error).toBeNull();
      expect((data || []).length).toBe(1);
      expect(data?.[0]?.task_type).toBe("preventivo");
      expect(data?.[0]?.priority).toBe("importante");
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("reativacao >=100% gera critico e >=130% vira critica maxima na reason", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-reactivation");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 135 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 105 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 75 });
      await createPaidOrder(supabase, { customerId, seed, daysAgo: 45 });

      await runCopilot(supabase);

      const { data, error } = await supabase
        .from("rfv_tasks")
        .select("task_type,priority,reason")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate())
        .single();

      expect(error).toBeNull();
      expect(data?.task_type).toBe("reativacao");
      expect(data?.priority).toBe("critico");
      expect((data?.reason || "").toLowerCase()).toContain("130%");
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("rodar run_rfv_copilot() 3x no dia nao duplica tarefas", async () => {
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
      await runCopilot(supabase);

      const { data, error } = await supabase
        .from("rfv_tasks")
        .select("id")
        .eq("customer_id", customerId)
        .eq("task_date", todayIsoDate())
        .in("status", ["pendente", "enviado", "respondeu", "converteu", "sem_resposta", "skipped"]);

      expect(error).toBeNull();
      expect((data || []).length).toBe(1);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("attribute_rfv_revenue() atribui para o primeiro pedido pago apos sent", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rfv-revenue");
    let customerId: string | undefined;
    let firstOrderId: string | undefined;

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
        .single();

      expect(taskError).toBeNull();
      const taskId = task?.id as string;
      expect(taskId).toBeTruthy();

      const executedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await supabase
        .from("rfv_tasks")
        .update({
          status: "enviado",
          executed_by: "rfv-regression-test",
          executed_at: executedAt,
        })
        .eq("id", taskId);

      expect(updateError).toBeNull();

      const firstPaidAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const secondPaidAt = new Date(Date.now() - 30 * 60 * 1000).toISOString();

      firstOrderId = await createPaidOrder(supabase, {
        customerId,
        seed,
        paidAtIso: firstPaidAt,
        total: 123,
      });

      await createPaidOrder(supabase, {
        customerId,
        seed,
        paidAtIso: secondPaidAt,
        total: 321,
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
      expect(convertedTask?.converted_order_id).toBe(firstOrderId);
      expect(Number(convertedTask?.revenue_generated || 0)).toBe(123);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);
});

