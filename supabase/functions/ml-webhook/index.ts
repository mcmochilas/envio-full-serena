// Recebe as notificações do Mercado Livre (estoque Full / items) e dispara a sincronização do painel
import { createClient } from "npm:@supabase/supabase-js@2";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

Deno.serve(async (req) => {
  const corpo = await req.json().catch(() => ({}));
  const tarefa = (async () => {
    const { data } = await db.from("full_ml_auth").select("cron_token,refresh_token").eq("id", 1).maybeSingle();
    if (!data?.refresh_token || !data?.cron_token) return;
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/full-api`, {
      method: "POST", headers: { "content-type": "application/json", "x-full-int": data.cron_token },
      body: JSON.stringify({ op: "ml_sync", motivo: String(corpo?.topic || "") }),
    }).catch(() => {});
  })();
  // responde na hora (o Mercado Livre espera resposta rápida) e sincroniza em segundo plano
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime; if (er?.waitUntil) er.waitUntil(tarefa); else await tarefa;
  return new Response("ok", { status: 200 });
});
