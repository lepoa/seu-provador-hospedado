import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function FixOrders() {
  const [log, setLog] = useState<string[]>([]);
  const [done, setDone] = useState(false);

  const addLog = (msg: string) => setLog(prev => [...prev, msg]);

  useEffect(() => {
    (async () => {
      try {
        addLog("Buscando pedidos corrompidos...");
        
        const { data: corrupted, error } = await supabase
          .from("orders")
          .select("id, customer_name, customer_phone, live_cart_id")
          .eq("customer_name", "Bruna Oliveira")
          .eq("customer_phone", "6299384460");

        if (error) { addLog("ERRO: " + error.message); return; }
        addLog(`Encontrados ${corrupted?.length || 0} pedidos com "Bruna Oliveira" / 6299384460`);

        const brunaPrefix = "b7a9cb33";
        let fixed = 0;

        for (const order of (corrupted || [])) {
          if (order.id.toLowerCase().startsWith(brunaPrefix)) {
            addLog(`SKIP: ${order.id.substring(0,8)} (pedido real da Bruna)`);
            continue;
          }

          if (!order.live_cart_id) {
            addLog(`SEM CART: ${order.id.substring(0,8)}`);
            continue;
          }

          const { data: cart } = await supabase
            .from("live_carts")
            .select("live_customer:live_customers(nome, instagram_handle, whatsapp)")
            .eq("id", order.live_cart_id)
            .maybeSingle();

          if (cart?.live_customer) {
            const c = cart.live_customer as any;
            const origName = c.nome || (c.instagram_handle ? `@${c.instagram_handle}` : "Cliente Live");
            const origPhone = c.whatsapp || "";

            const { error: upErr } = await supabase
              .from("orders")
              .update({ customer_name: origName, customer_phone: origPhone })
              .eq("id", order.id);

            if (upErr) {
              addLog(`ERRO ao corrigir ${order.id.substring(0,8)}: ${upErr.message}`);
            } else {
              addLog(`✅ CORRIGIDO: ${order.id.substring(0,8)} → "${origName}" / "${origPhone}"`);
              fixed++;
            }
          } else {
            addLog(`SEM CLIENTE: ${order.id.substring(0,8)}`);
          }
        }

        addLog(`\nPronto! ${fixed} pedidos corrigidos.`);
        setDone(true);
      } catch (err: any) {
        addLog("ERRO GERAL: " + err.message);
      }
    })();
  }, []);

  return (
    <div style={{ padding: 40, fontFamily: "monospace", background: "#111", color: "#0f0", minHeight: "100vh" }}>
      <h2>🔧 Fix Corrupted Orders</h2>
      {log.map((l, i) => <div key={i}>{l}</div>)}
      {done && <div style={{ marginTop: 20, color: "#ff0" }}>
        <a href="/dashboard?tab=orders" style={{ color: "#ff0" }}>→ Voltar para Pedidos</a>
      </div>}
    </div>
  );
}
