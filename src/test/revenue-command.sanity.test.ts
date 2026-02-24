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

function isoDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function isoTimestampOffset(daysOffset: number): string {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + daysOffset);
  return d.toISOString();
}

async function createCustomer(supabase: SupabaseClient, seed: string): Promise<string> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: `RC ${seed}`,
      phone: fakePhone(seed),
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();
  return data!.id as string;
}

async function createOrder(
  supabase: SupabaseClient,
  params: {
    customerId: string;
    seed: string;
    total: number;
    status: string;
    paymentStatus?: string;
    dayOffset: number;
  }
): Promise<string> {
  const createdAt = isoTimestampOffset(params.dayOffset);
  const isPaid = params.status === "pago" || params.paymentStatus === "approved";

  const { data, error } = await supabase
    .from("orders")
    .insert({
      customer_id: params.customerId,
      customer_name: `RC ${params.seed}`,
      customer_phone: fakePhone(params.seed),
      customer_address: "Rua Teste, 123",
      total: params.total,
      source: "catalog",
      status: params.status,
      payment_status: params.paymentStatus ?? (isPaid ? "approved" : "pending"),
      paid_at: isPaid ? createdAt : null,
      created_at: createdAt,
    })
    .select("id")
    .single();

  expect(error).toBeNull();
  expect(data?.id).toBeTruthy();
  return data!.id as string;
}

async function createPendingTask(
  supabase: SupabaseClient,
  params: {
    customerId: string;
    taskDate: string;
    estimatedImpact: number;
  }
): Promise<void> {
  const { error } = await supabase.from("rfv_tasks").insert({
    customer_id: params.customerId,
    task_type: "preventivo",
    task_date: params.taskDate,
    priority: "importante",
    reason: "Revenue command test",
    suggested_message: "Mensagem teste",
    status: "pendente",
    estimated_impact: params.estimatedImpact,
  });

  expect(error).toBeNull();
}

async function cleanupCustomerData(supabase: SupabaseClient, customerId: string) {
  await supabase.from("rfv_tasks").delete().eq("customer_id", customerId);
  await supabase.from("orders").delete().eq("customer_id", customerId);
  await supabase.from("customers").delete().eq("id", customerId);
}

describe("revenue command regression", () => {
  it("uses median baseline for ticket and enforces latent revenue cap", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rc-median");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);

      await createOrder(supabase, {
        customerId,
        seed,
        total: 100,
        status: "pago",
        dayOffset: -2,
      });

      await createOrder(supabase, {
        customerId,
        seed,
        total: 100,
        status: "pago",
        dayOffset: -18,
      });

      await createOrder(supabase, {
        customerId,
        seed,
        total: 10000,
        status: "pago",
        dayOffset: -20,
      });

      for (let i = 0; i < 15; i += 1) {
        await createOrder(supabase, {
          customerId,
          seed: `${seed}-${i}`,
          total: 100,
          status: "pendente",
          paymentStatus: "pending",
          dayOffset: -1,
        });
      }

      const { data, error } = await supabase.rpc("get_revenue_command", {
        p_start_date: isoDateOffset(-6),
        p_end_date: isoDateOffset(0),
        p_channel: "all",
        p_store_id: null,
      });

      expect(error).toBeNull();
      const result = (data || {}) as any;

      const baselineTicket = Number(result?.raw?.baseline_ticket_value || 0);
      const idealTicket = Number(result?.breakdown_componentes?.ticket?.ideal || 0);
      const receitaLatente = Number(result?.receita_latente || 0);
      const paidTotal = Number(result?.raw?.paid_total || 0);
      const rawLatente = Number(result?.raw?.receita_latente_raw || 0);

      expect(baselineTicket).toBeGreaterThan(90);
      expect(baselineTicket).toBeLessThan(110);
      expect(idealTicket).toBeGreaterThan(100);
      expect(idealTicket).toBeLessThan(130);
      expect(receitaLatente).toBeLessThanOrEqual(paidTotal * 1.2 + 0.0001);
      expect(rawLatente).toBeGreaterThanOrEqual(receitaLatente);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("does not collapse cancel impact when period is fully canceled", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rc-cancel");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);

      await createOrder(supabase, {
        customerId,
        seed,
        total: 300,
        status: "cancelado",
        paymentStatus: "rejected",
        dayOffset: -1,
      });

      await createOrder(supabase, {
        customerId,
        seed,
        total: 200,
        status: "cancelado",
        paymentStatus: "rejected",
        dayOffset: -2,
      });

      const { data, error } = await supabase.rpc("get_revenue_command", {
        p_start_date: isoDateOffset(-6),
        p_end_date: isoDateOffset(0),
        p_channel: "all",
        p_store_id: null,
      });

      expect(error).toBeNull();
      const result = (data || {}) as any;

      const cancelImpact = Number(result?.breakdown_componentes?.cancelamento?.impacto_estimado || 0);
      const canceledTotalReal = Number(result?.breakdown_componentes?.cancelamento?.cancelled_total_real || 0);

      expect(canceledTotalReal).toBeCloseTo(500, 2);
      expect(cancelImpact).toBeCloseTo(500, 2);
      expect(cancelImpact).toBeGreaterThan(0);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);

  it("keeps RFV impact on historical windows based on v_end + 1..+7", async () => {
    const supabase = getServiceClient();
    if (!supabase) {
      expect(true).toBe(true);
      return;
    }

    const seed = runId("rc-rfv-history");
    let customerId: string | undefined;

    try {
      customerId = await createCustomer(supabase, seed);

      const endDate = isoDateOffset(-20);
      const startDate = isoDateOffset(-26);
      const taskDate = isoDateOffset(-17);

      await createPendingTask(supabase, {
        customerId,
        taskDate,
        estimatedImpact: 123,
      });

      const { data, error } = await supabase.rpc("get_revenue_command", {
        p_start_date: startDate,
        p_end_date: endDate,
        p_channel: "all",
        p_store_id: null,
      });

      expect(error).toBeNull();
      const result = (data || {}) as any;
      const impactRfv = Number(result?.breakdown_componentes?.rfv_pendente?.impacto_estimado || 0);

      expect(impactRfv).toBeCloseTo(123, 2);
    } finally {
      if (customerId) await cleanupCustomerData(supabase, customerId);
    }
  }, 60000);
});
