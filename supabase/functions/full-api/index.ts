// Envio Full Serena — API única (login usuário+PIN, QR do celular, envios, separação)
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-full-token, x-full-qr, authorization, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const out = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
class Erro extends Error { constructor(m: string, public s = 400) { super(m); } }
const must = (c: unknown, m: string, s = 403) => { if (!c) throw new Erro(m, s); };
const q = async <T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const { data, error } = await p; if (error) throw new Erro(error.message, 500); return data; };
const rnd = (n: number) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");

type Me = { login: string; nome: string; role: string; qrEnvio?: string };

async function quem(req: Request): Promise<Me | null> {
  const t = req.headers.get("x-full-token"), qr = req.headers.get("x-full-qr");
  if (t) {
    const s = await q(db.from("full_sessions").select("login,expira").eq("token", t).maybeSingle());
    if (!s || new Date(s.expira) < new Date()) return null;
    const u = await q(db.from("full_users").select("login,nome,role,ativo").eq("login", s.login).maybeSingle());
    return u && u.ativo ? { login: u.login, nome: u.nome, role: u.role } : null;
  }
  if (qr) {
    const k = await q(db.from("full_qr").select("envio,login,revogado").eq("token", qr).maybeSingle());
    if (!k || k.revogado) return null;
    const [e, u] = await Promise.all([
      q(db.from("full_envios").select("status").eq("id", k.envio).maybeSingle()),
      q(db.from("full_users").select("login,nome,role,ativo").eq("login", k.login).maybeSingle()),
    ]);
    if (!e || e.status !== "liberado") return null;
    return u && u.ativo ? { login: u.login, nome: u.nome, role: "expedicao", qrEnvio: k.envio } : null;
  }
  return null;
}
const log = (envio: string, msg: string) => db.from("full_log").insert({ envio, msg: String(msg).slice(0, 300) });
const toque = (id: string) => db.from("full_envios").update({ updated_at: new Date().toISOString() }).eq("id", id);

async function rev() {
  const [a, b, c] = await Promise.all([
    q(db.from("full_envios").select("updated_at").order("updated_at", { ascending: false }).limit(1)),
    q(db.from("full_vinc").select("updated_at").order("updated_at", { ascending: false }).limit(1)),
    db.from("full_envios").select("id", { count: "exact", head: true }),
  ]);
  const count = c.count;
  return `${a[0]?.updated_at || ""}|${b[0]?.updated_at || ""}|${count ?? ""}`;
}

async function estado(me: Me, since?: string) {
  const r = await rev();
  if (since && since === r) return { rev: r, same: true };
  let sel = db.from("full_envios").select("id,criado,status,pvs,anuncios,pre,manual,motivo,updated_at").order("criado", { ascending: false }).limit(400);
  if (me.qrEnvio) sel = sel.eq("id", me.qrEnvio);
  else if (me.role !== "gestor") sel = sel.in("status", ["liberado", "concluido"]);
  const envios = await q(sel);
  const ids = envios.map((e: { id: string }) => e.id);
  const ativos = envios.filter((e: { status: string }) => e.status !== "concluido").map((e: { id: string }) => e.id);
  // celular (QR): só o que a tela de separação usa, em paralelo
  if (me.qrEnvio) {
    const invs = [...new Set(envios.flatMap((e: any) => (e.anuncios || []).map((a: any) => a.inv)))];
    const [sep, vinc, blocks, users] = await Promise.all([
      ids.length ? q(db.from("full_sep").select("envio,cod,status,resp,n,lab").in("envio", ids)) : [],
      invs.length ? q(db.from("full_vinc").select("inv,cod,mult").in("inv", invs)) : [],
      q(db.from("blocks").select("id,data")),
      q(db.from("full_users").select("login,nome,role,ativo,modo").eq("ativo", true)),
    ]);
    const cods = [...new Set(vinc.map((v: any) => v.cod).filter(Boolean))];
    const [erp, prods] = cods.length ? await Promise.all([
      q(db.from("full_erp").select("cod,nome,ean").in("cod", cods)),
      q(db.from("products").select("id,data").in("id", cods)),
    ]) : [[], []];
    return {
      rev: r, me, envios, sep, logs: [], vinc, erp,
      locs: Object.fromEntries(prods.map((p: any) => [p.id, p.data?.loc || ""])),
      blocks: Object.fromEntries(blocks.map((b: any) => [b.id, b.data])),
      users,
    };
  }
  const [sep, logs, vinc, erp, blocks, users] = await Promise.all([
    ids.length ? q(db.from("full_sep").select("envio,cod,status,resp,n,lab").in("envio", ids)) : [],
    ativos.length ? q(db.from("full_log").select("envio,at,msg").in("envio", ativos).order("at", { ascending: false }).limit(300)) : [],
    q(db.from("full_vinc").select("inv,cod,mult")),
    q(db.from("full_erp").select("cod,nome,ean")),
    q(db.from("blocks").select("id,data")),
    q(db.from("full_users").select("login,nome,role,ativo,modo").order("nome")),
  ]);
  const cods = erp.map((p: { cod: string }) => p.cod);
  const prods = cods.length ? await q(db.from("products").select("id,data").in("id", cods)) : [];
  return {
    rev: r, me,
    envios, sep, logs, vinc, erp,
    locs: Object.fromEntries(prods.map((p: { id: string; data: { loc?: string } }) => [p.id, p.data?.loc || ""])),
    blocks: Object.fromEntries(blocks.map((b: { id: string; data: unknown }) => [b.id, b.data])),
    users: users.filter((u: { ativo: boolean }) => me.role === "gestor" || u.ativo),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const b = await req.json().catch(() => ({}));
    const op = String(b.op || "");

    if (op === "login") {
      const tok = await q(db.rpc("full_login", { p_login: String(b.login || ""), p_pin: String(b.pin || "") }));
      if (!tok) throw new Erro("Usuário ou PIN incorreto.", 401);
      const s = await q(db.from("full_sessions").select("login").eq("token", tok).single());
      const u = await q(db.from("full_users").select("login,nome,role").eq("login", s.login).single());
      return out({ token: tok, me: u });
    }

    const me = await quem(req);
    if (!me) throw new Erro(req.headers.get("x-full-qr") ? "Link inválido ou expirado." : "Sessão expirada. Entre de novo.", 401);
    const gestor = me.role === "gestor";
    const doEnvio = (id: string) => { must(!me.qrEnvio || me.qrEnvio === id, "Este link não é deste envio."); };

    switch (op) {
      case "logout": await db.from("full_sessions").delete().eq("token", req.headers.get("x-full-token") || ""); return out({ ok: true });
      case "state": return out(await estado(me, b.since));

      case "importar": {
        must(gestor && !me.qrEnvio, "Só o gestor importa envios.");
        const e = b.envio; must(e && /^[\w-]{3,40}$/.test(e.id) && Array.isArray(e.anuncios) && e.anuncios.length, "Envio inválido.", 400);
        const erp = Object.entries(b.erp || {}).map(([cod, p]: [string, any]) => ({ cod, nome: String(p.nome || cod), ean: String(p.ean || "") }));
        if (erp.length) await q(db.from("full_erp").upsert(erp));
        const ex = await q(db.from("full_vinc").select("inv,cod"));
        const temCod = new Set(ex.filter((v: { cod: string }) => v.cod).map((v: { inv: string }) => v.inv));
        const novos = Object.entries(b.vinc || {}).filter(([inv]) => !temCod.has(inv)).map(([inv, v]: [string, any]) => ({ inv, cod: String(v.cod || ""), mult: Math.max(1, +v.mult || 1), updated_at: new Date().toISOString() }));
        if (novos.length) await q(db.from("full_vinc").upsert(novos));
        await q(db.from("full_envios").delete().eq("id", e.id));
        await q(db.from("full_envios").insert({ id: e.id, status: "rascunho", pvs: e.pvs || [], anuncios: e.anuncios, pre: e.pre || {} }));
        await log(e.id, `${me.nome} importou o envio`);
        return out({ ok: true });
      }
      case "prod": {
        must(gestor && !me.qrEnvio, "Só o gestor busca produtos.");
        const t = String(b.q || "").trim().replace(/[%,()]/g, "");
        if (t.length < 2) return out({ itens: [] });
        const a1 = await q(db.from("products").select("id,data").ilike("id", `${t}%`).limit(8));
        const a2 = await q(db.from("products").select("id,data").ilike("data->>name", `%${t.replace(/\s+/g, "%")}%`).limit(8));
        const m = new Map();
        [...a1, ...a2].forEach((p: any) => m.set(p.id, { cod: p.id, nome: p.data?.name || p.id, ean: p.data?.ean || "" }));
        return out({ itens: [...m.values()].slice(0, 8) });
      }
      case "vinc": {
        must(gestor && !me.qrEnvio, "Só o gestor altera vínculos.");
        if (b.cod) {
          const ja = await q(db.from("full_erp").select("cod").eq("cod", String(b.cod)).maybeSingle());
          if (!ja) { const p = await q(db.from("products").select("id,data").eq("id", String(b.cod)).maybeSingle());
            await q(db.from("full_erp").upsert({ cod: String(b.cod), nome: p?.data?.name || String(b.cod), ean: p?.data?.ean || "" })); }
        }
        await q(db.from("full_vinc").upsert({ inv: String(b.inv), cod: String(b.cod || ""), mult: Math.max(1, +b.mult || 1), updated_at: new Date().toISOString() }));
        return out({ ok: true });
      }
      case "atualizar": {
        must(gestor && !me.qrEnvio, "Só o gestor atualiza envios.");
        const e = await q(db.from("full_envios").select("status").eq("id", b.id).maybeSingle());
        must(e, "Envio não encontrado.", 404); must(e.status !== "concluido", "Envio já concluído.", 400);
        const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }; const oq: string[] = [];
        if (Array.isArray(b.anuncios)) {
          must(b.anuncios.length > 0, "Nenhuma etiqueta nos arquivos.", 400);
          upd.anuncios = b.anuncios; oq.push(`etiquetas (${b.anuncios.length} anúncios)`);
          const ex = await q(db.from("full_vinc").select("inv,cod"));
          const temCod = new Set(ex.filter((v: { cod: string }) => v.cod).map((v: { inv: string }) => v.inv));
          const novos = Object.entries(b.vinc || {}).filter(([inv]) => !temCod.has(inv)).map(([inv, v]: [string, any]) => ({ inv, cod: String(v.cod || ""), mult: Math.max(1, +v.mult || 1), updated_at: new Date().toISOString() }));
          if (novos.length) await q(db.from("full_vinc").upsert(novos));
        }
        if (b.pre && typeof b.pre === "object") {
          upd.pre = b.pre; upd.pvs = Array.isArray(b.pvs) ? b.pvs : []; oq.push(`pré-venda (${(upd.pvs as string[]).join(", ")})`);
          const erp = Object.entries(b.erp || {}).map(([cod, p]: [string, any]) => ({ cod, nome: String(p.nome || cod), ean: String(p.ean || "") }));
          if (erp.length) await q(db.from("full_erp").upsert(erp));
        }
        must(oq.length, "Nada para atualizar.", 400);
        await q(db.from("full_envios").update(upd).eq("id", b.id));
        await log(b.id, `${me.nome} atualizou ${oq.join(" e ")}`);
        return out({ ok: true });
      }
      case "modo": {
        must(["camera", "bluetooth", "coletor"].includes(b.modo), "Modo de bipagem inválido.", 400);
        const alvo = gestor && !me.qrEnvio && b.login ? String(b.login) : me.login;
        await q(db.from("full_users").update({ modo: b.modo }).eq("login", alvo));
        return out({ ok: true });
      }
      case "liberar": {
        must(gestor && !me.qrEnvio, "Só o gestor libera envios.");
        await q(db.from("full_envios").update({ status: "liberado", updated_at: new Date().toISOString() }).eq("id", b.id));
        await log(b.id, `${me.nome} liberou para a expedição`); return out({ ok: true });
      }
      case "excluir": {
        must(gestor && !me.qrEnvio, "Só o gestor exclui envios.");
        const e = await q(db.from("full_envios").select("status").eq("id", b.id).maybeSingle());
        must(e, "Envio não encontrado.", 404);
        await q(db.from("full_envios").delete().eq("id", b.id)); return out({ ok: true });
      }
      case "addpre": case "rmpre": {
        must(gestor && !me.qrEnvio, "Só o gestor altera a pré-venda.");
        const e = await q(db.from("full_envios").select("manual").eq("id", b.id).single());
        const m = e.manual || {};
        if (op === "addpre") m[b.cod] = { qtd: (m[b.cod]?.qtd || 0) + Math.max(1, +b.qtd || 0), por: me.login, em: new Date().toISOString() }; else delete m[b.cod];
        await q(db.from("full_envios").update({ manual: m, updated_at: new Date().toISOString() }).eq("id", b.id));
        await log(b.id, op === "addpre" ? `${me.nome} adicionou ${b.qtd} × ${b.cod} à pré-venda` : `${me.nome} removeu o item manual ${b.cod}`);
        return out({ ok: true });
      }
      case "concluir": {
        doEnvio(b.id); must(!me.qrEnvio, "Conclua o envio pelo computador.");
        await q(db.from("full_envios").update({ status: "concluido", updated_at: new Date().toISOString() }).eq("id", b.id).eq("status", "liberado"));
        await q(db.from("full_qr").update({ revogado: true }).eq("envio", b.id));
        await log(b.id, `${me.nome} concluiu o envio`); return out({ ok: true });
      }
      case "sep": {
        doEnvio(b.envio);
        const acao = String(b.acao);
        must(!me.qrEnvio || ["pega", "n", "tudo", "done", "solta"].includes(acao), "Ação não permitida pelo celular.");
        const r = await q(db.rpc("full_sep_op", { p_envio: b.envio, p_cod: String(b.cod), p_login: me.login, p_acao: acao, p_inv: b.inv ?? null, p_max: b.max ?? null, p_total: b.total ?? null, p_final: !!b.final }));
        if (!r.erro && b.msg) await log(b.envio, `${me.nome} ${b.msg}`);
        return out(r);
      }
      case "log": { doEnvio(b.envio); await log(b.envio, `${me.nome} ${b.msg}`); await toque(b.envio); return out({ ok: true }); }
      case "qr": {
        must(!me.qrEnvio, "Gere o QR pelo computador.");
        const u = await q(db.from("full_users").select("login,ativo").eq("login", String(b.login)).maybeSingle());
        must(u && u.ativo, "Usuário inválido.", 400);
        if (b.novo) await q(db.from("full_qr").update({ revogado: true }).eq("envio", b.envio).eq("login", u.login));
        const ex = b.novo ? [] : await q(db.from("full_qr").select("token").eq("envio", b.envio).eq("login", u.login).eq("revogado", false).limit(1));
        let token = ex[0]?.token;
        if (!token) { token = rnd(18); await q(db.from("full_qr").insert({ token, envio: b.envio, login: u.login })); }
        return out({ token });
      }
      case "user": {
        must(gestor && !me.qrEnvio, "Só o gestor gerencia usuários.");
        const login = String(b.login || "").trim().toLowerCase();
        must(/^[a-z0-9._-]{2,30}$/.test(login), "Login inválido: use letras minúsculas, números, ponto ou traço.", 400);
        must(["gestor", "expedicao"].includes(b.role), "Perfil inválido.", 400);
        const ex = await q(db.from("full_users").select("login").eq("login", login).maybeSingle());
        if (b.pin !== undefined && b.pin !== "") must(/^\d{4}$/.test(String(b.pin)), "O PIN precisa ter 4 números.", 400);
        if (!ex) {
          must(/^\d{4}$/.test(String(b.pin || "")), "Informe um PIN de 4 números.", 400);
          await q(db.from("full_users").insert({ login, nome: String(b.nome || login).slice(0, 60), role: b.role, pin_hash: "x", ativo: b.ativo !== false, modo: ["camera", "bluetooth", "coletor"].includes(b.modo) ? b.modo : "camera" }));
        } else {
          must(!(login === me.login && (b.ativo === false || b.role !== "gestor")), "Você não pode desativar ou rebaixar o seu próprio usuário.", 400);
          await q(db.from("full_users").update({ nome: String(b.nome || login).slice(0, 60), role: b.role, ativo: b.ativo !== false, ...(["camera", "bluetooth", "coletor"].includes(b.modo) ? { modo: b.modo } : {}) }).eq("login", login));
          if (b.ativo === false) await q(db.from("full_sessions").delete().eq("login", login));
        }
        if (b.pin) await q(db.rpc("full_set_pin", { p_login: login, p_pin: String(b.pin) }));
        return out({ ok: true });
      }
      default: throw new Erro("Operação desconhecida.", 400);
    }
  } catch (e) {
    const s = e instanceof Erro ? e.s : 500;
    return out({ erro: e instanceof Error ? e.message : String(e) }, s);
  }
});
