/* ===== GESTOR · ESTOQUE NO FULL (API do Mercado Livre) ===== */
const ML_TIPOS={inbound_reception:"Abastecimento do Full",sale_confirmation:"Venda",sale_cancelation:"Venda cancelada",sale_delivery_cancelation:"Devolução · entrega não concluída",sale_return:"Devolução do comprador",
  withdrawal_reservation:"Retirada reservada",withdrawal_cancelation:"Retirada cancelada",withdrawal_delivery:"Retirada entregue",withdrawal_removal:"Removido após retirada",
  transfer_reservation:"Transferência reservada",transfer_ajustment:"Ajuste de transferência",transfer_delivery:"Transferência entregue",
  quarantine_reservation:"Em quarentena",quarantine_restock:"Voltou da quarentena",lost_refund:"Perdido (reembolsado)",damaged_removal:"Avariado removido",
  removal_reservation:"Descarte reservado",removal_completion:"Descartado",ajustement:"Ajuste de estoque",adjustment:"Ajuste de estoque",fiscal_coverage_adjustment:"Ajuste fiscal",stock_audit:"Auditoria de estoque"};
const ML_GRUPO={inbound_reception:"ent",sale_return:"dev",sale_delivery_cancelation:"dev",sale_confirmation:"ven",sale_cancelation:"ven"};
const BRL=v=>(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const n0=v=>(v||0).toLocaleString("pt-BR");
let ML_CARREGANDO=false;

async function mlCarregar(){ if(ML_CARREGANDO) return; ML_CARREGANDO=true; DB.mlErro=null;
  try{ DB.ml=await api("ml_painel",{dias:DB.mlDias||30}); }catch(x){ DB.mlErro=x.message; }
  ML_CARREGANDO=false; if(DB.tab==="estoque") render(); }

function mlConectar(){ const st=Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem("envio-full-mlstate",st);
  const c=DB.ml||{}; location.href=`https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${encodeURIComponent(c.client_id||"770978757588091")}&redirect_uri=${encodeURIComponent(c.redirect||location.origin+"/")}&state=${st}`; }

/* volta do Mercado Livre com ?code=… */
async function mlPendente(){ const u=new URL(location.href), code=u.searchParams.get("code"), st=u.searchParams.get("state"); if(!code) return;
  history.replaceState(null,"",location.pathname+location.hash);
  if(!DB.me||DB.meObj?.role!=="gestor"){ toast("Entre como gestor para conectar"); return; }
  if(st!==localStorage.getItem("envio-full-mlstate")){ toast("Autorização inválida, tente de novo"); return; }
  localStorage.removeItem("envio-full-mlstate"); DB.tab="estoque"; DB.mlSync=true; render(); toast("Conectando ao Mercado Livre…");
  try{ await api("ml_callback",{code}); toast("Mercado Livre conectado"); }catch(x){ toast(x.message); }
  DB.mlSync=false; await mlCarregar(); }

/* teto de pico: uma venda acima de N× o tamanho típico do anúncio (mediana dos últimos 180 dias) conta só até o teto na cobertura */
const mlTeto=()=>{ if(DB.mlTeto===undefined){ try{ DB.mlTeto=+(localStorage.getItem("envio-full-teto")??3); }catch(e){ DB.mlTeto=3; } } return DB.mlTeto; };
function mlCalc(){ const c=DB.ml||{}, dias=c.dias||30; const K=mlTeto(), VD=c.vendas||{}; const custo={}; (c.custos||[]).forEach(x=>custo[x.cod]=+x.custo);
  const R={}; (c.resumo||[]).forEach(r=>{ (R[r.inv]=R[r.inv]||{})[r.tipo]={d:+r.disp||0,i:+r.indisp||0,n:+r.n||0}; });
  const q=(inv,t,campo)=>{ const x=(R[inv]||{})[t]; if(!x) return 0; const v=Math.abs(campo==="t"?x.d+x.i:x.d); return v||x.n; };
  const linhas=(c.estoque||[]).map(e=>{ const v=V(e.inv), mult=v.mult||1, cod=v.cod||"", cu=cod&&custo[cod]!==undefined?custo[cod]:null;
    const canc=q(e.inv,"sale_cancelation","d"), vend=Math.max(0,q(e.inv,"sale_confirmation","d")-canc);
    const ent=q(e.inv,"inbound_reception","t"), dev=q(e.inv,"sale_return","t")+q(e.inv,"sale_delivery_cancelation","t");
    const vd=VD[e.inv]||{q:[]}, qs=(vd.q||[]).map(Number), tip=Math.max(1,+vd.med||1), teto=K>0?Math.max(1,Math.round(K*tip)):Infinity;
    const picos=qs.filter(x=>x>teto), vendTip=Math.max(0,qs.reduce((t,x)=>t+Math.min(x,teto),0)-canc);
    const md=vendTip/dias, cob=md>0?e.disponivel/md:null, mdBruta=vend/dias, cobBruta=mdBruta>0?e.disponivel/mdBruta:null;
    const espor=qs.length>0&&qs.length<=2;
    return {...e,cod,mult,cu,vend,vendTip,nVendas:qs.length,picos,teto,tip,espor,cobBruta,ent,dev,md,cob,custoDisp:cu!==null?e.disponivel*mult*cu:null,custoTot:cu!==null?e.total*mult*cu:null,pecas:e.disponivel*mult}; });
  const ativos=linhas.filter(l=>l.total>0);
  const modelos=new Set(ativos.filter(l=>l.cod).map(l=>l.cod));
  const comCob=ativos.filter(l=>l.cob!==null&&l.custoDisp&&!l.espor);
  const pes=comCob.reduce((t,l)=>t+l.custoDisp,0);
  const cobMedia=comCob.length?(pes>0?comCob.reduce((t,l)=>t+l.cob*l.custoDisp,0)/pes:comCob.reduce((t,l)=>t+l.cob,0)/comCob.length):null;
  return {linhas,ativos,dias,modelos:modelos.size,cobMedia,
    custoDisp:ativos.reduce((t,l)=>t+(l.custoDisp||0),0), custoTot:ativos.reduce((t,l)=>t+(l.custoTot||0),0),
    semCusto:ativos.filter(l=>l.cu===null).length, semVinc:ativos.filter(l=>!l.cod).length, semVenda:ativos.filter(l=>l.cob===null&&l.disponivel>0).length,
    pecas:ativos.reduce((t,l)=>t+l.pecas,0), unid:ativos.reduce((t,l)=>t+l.disponivel,0), indisp:ativos.reduce((t,l)=>t+l.indisponivel,0),
    ent:linhas.reduce((t,l)=>t+l.ent,0), dev:linhas.reduce((t,l)=>t+l.dev,0), devPecas:linhas.reduce((t,l)=>t+l.dev*l.mult,0), vend:linhas.reduce((t,l)=>t+l.vend,0)}; }

const cobTxt=c=>c===null?"sem venda":c>=999?"999+ dias":`${Math.round(c)} dia${Math.round(c)===1?"":"s"}`;
function cobCel(l){
  const dec=v=>v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
  const K=mlTeto(), dias=(DB.ml||{}).dias||30;
  const lin=(a,b,cls="")=>`<tr class="${cls}"><th>${a}</th><td>${b}</td></tr>`;
  const tab=`<table class="ctt"><tbody>
    ${l.nVendas?lin("Venda típica (mediana 180 dias)",`${n0(l.tip)} un`):""}
    ${l.nVendas&&K?lin(`Teto de pico (${K}×)`,`${n0(l.teto)} un`):""}
    ${l.picos.length?lin("Vendas acima do teto",l.picos.map(x=>`${n0(x)} un`).join(" · "),"ctpk"):""}
    ${l.nVendas?lin("Vendas por dia (com corte)",dec(l.md)):""}
    ${l.picos.length?lin("Vendas por dia (sem corte)",dec(l.vend/dias)):""}
    ${lin("Cobertura",`<b>${cobTxt(l.cob)}</b>`,"cttot")}
    ${l.picos.length?lin("Cobertura sem corte",cobTxt(l.cobBruta)):""}
  </tbody></table>${l.espor?`<div class="ctnota">Venda esporádica: só ${l.nVendas} venda${l.nVendas>1?"s":""} no período, projeção pouco confiável.</div>`:""}`;
  return `<span class="ctw" tabindex="0"><span class="tag ${l.espor?"tag-off":cobCls(l.cob)}">${l.espor?"esporádica":cobTxt(l.cob)}${l.picos.length?' <b aria-label="teve pico">⚡</b>':""}</span><span class="ctip" role="tooltip">${tab}</span></span>`; }
const cobCls=c=>c===null?"tag-off":c<15?"tag-warn":c>90?"tag-err":"tag-ok";

function gEstoque(){
  if(!DB.ml&&!DB.mlErro){ mlCarregar(); return `<div class="hdr"><div><span class="eyebrow">Mercado Livre · Full</span><h1>Estoque no Full</h1></div></div><div class="panel"><span class="muted">Carregando estoque…</span></div>`; }
  const c=DB.ml||{};
  const hdr=`<div class="hdr"><div><span class="eyebrow">Mercado Livre · Full</span><h1>Estoque no Full</h1>
      ${c.conectado?`<span class="muted">Conta ${esc(c.nick||"conectada")} · ${c.ultima_sync?`sincronizado ${new Date(c.ultima_sync).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"})}`:"ainda não sincronizado"}</span>`:""}</div>
    <div class="acts">${c.conectado?`<button class="btn" data-act="ml-sync" ${DB.mlSync?"disabled":""}>${DB.mlSync?"Sincronizando…":"Sincronizar agora"}</button>`:""}
      <button class="btn" data-act="ml-custos">Subir custos (.xlsx/.csv)</button></div></div>`;
  if(DB.mlErro) return hdr+`<div class="lmsg err">${esc(DB.mlErro)}</div><button class="btn" data-act="ml-recarregar">Tentar de novo</button>`;
  if(!c.conectado) return hdr+`<div class="panel mlcon"><h3>Conecte a conta do Mercado Livre</h3>
      <p class="muted">O painel lê pela API do Mercado Livre o estoque de cada anúncio no Full e as movimentações: entradas, devoluções, vendas e ajustes. É só leitura: nada é alterado na sua conta.</p>
      ${c.msg?`<div class="lmsg err">${esc(c.msg)}</div>`:""}
      <div><button class="btn btn-dark" data-act="ml-conectar">Conectar Mercado Livre</button></div>
      <p class="hint">Antes, cadastre a <b>ML_CLIENT_SECRET</b> nos Secrets das Edge Functions do Supabase.</p></div>`;
  const m=mlCalc(), dias=m.dias;
  const per=[15,30,60,90].map(d=>`<button aria-pressed="${dias===d&&!DB.mlCustom}" data-act="ml-dias" data-d="${d}">${d} dias</button>`).join("")
    +`<button aria-pressed="${!!DB.mlCustom}" data-act="ml-dias" data-d="custom">Personalizado</button>`;
  const card=(v,l,s)=>`<div class="sum"><b class="num">${v}</b><span>${l}</span>${s?`<small class="t2">${s}</small>`:""}</div>`;
  const qs=(DB.mlQ||"").trim().toLowerCase();
  let lst=m.ativos.filter(l=>!qs||[l.inv,l.titulo,l.cod,nomeCod(l.cod),l.sku].join(" ").toLowerCase().includes(qs));
  const ord=DB.mlOrd||"cob";
  lst.sort((a,b)=>ord==="custo"?(b.custoDisp||0)-(a.custoDisp||0):ord==="vend"?b.vend-a.vend:ord==="disp"?b.disponivel-a.disponivel:(((a.espor?1e8:0)+(a.cob??1e9))-((b.espor?1e8:0)+(b.cob??1e9))));
  const porModelo=DB.mlModelo;
  let corpo;
  if(porModelo){
    const g=new Map(); lst.forEach(l=>{ const k=l.cod||"—"; const x=g.get(k)||{cod:l.cod,an:[],pecas:0,custo:0,vend:0}; x.an.push(l); x.pecas+=l.pecas; x.custo+=l.custoDisp||0; x.vend+=l.vendTip*l.mult; g.set(k,x); });
    const gs=[...g.values()].sort((a,b)=>b.custo-a.custo); const P=pager("mlm",gs.length,15);
    corpo=`<div class="tbl"><table class="t"><thead><tr><th>Modelo</th><th class="r">Anúncios</th><th class="r">Peças disponíveis</th><th class="r">Custo</th><th class="r">Peças vendidas</th><th class="r">Cobertura <button class="hbtn hbtn-s" data-act="ajuda-cob" title="Como a cobertura é calculada" aria-label="Como a cobertura é calculada">!</button></th></tr></thead><tbody>
      ${gs.slice(P.ini,P.fim).map(x=>{ const md=x.vend/dias, cob=md>0?x.pecas/md:null; return `<tr><td>${x.cod?`<b>${x.cod}</b> · ${esc(nomeCod(x.cod))}`:`<span class="tag tag-warn">sem vínculo</span>`}<div class="t2">${x.an.map(a=>`${esc(a.inv)} (${a.mult} un)`).join(" · ")}</div></td>
        <td class="r num">${x.an.length}</td><td class="r num">${n0(x.pecas)}</td><td class="r num">${x.custo?BRL(x.custo):"—"}</td><td class="r num">${n0(x.vend)}</td><td class="r"><span class="tag ${cobCls(cob)}">${cobTxt(cob)}</span></td></tr>`; }).join("")||`<tr><td colspan="6" class="muted">Nada encontrado.</td></tr>`}
      </tbody></table></div>${P.html}`;
  } else {
    const P=pager("mla",lst.length,15);
    corpo=`<div class="tbl"><table class="t"><thead><tr><th>Anúncio</th><th>Modelo</th><th class="r">Kit</th><th class="r">Disponível</th><th class="r">Indisp.</th><th class="r">Custo</th><th class="r">Vendas</th><th class="r">Cobertura <button class="hbtn hbtn-s" data-act="ajuda-cob" title="Como a cobertura é calculada" aria-label="Como a cobertura é calculada">!</button></th></tr></thead><tbody>
      ${lst.slice(P.ini,P.fim).map(l=>`<tr class="mlrow ${DB.mlInv===l.inv?"open":""}" data-act="ml-hist" data-inv="${esc(l.inv)}" tabindex="0"><td><span class="mono">${esc(l.inv)}</span><div class="t2 mltit">${esc(l.titulo||"")}</div></td>
          <td>${l.cod?`${l.cod} · ${esc(nomeCod(l.cod))}`:`<div class="combo"><input class="inp" data-vq="${esc(l.inv)}" value="" placeholder="Vincular produto do ERP…" autocomplete="off" role="combobox" aria-expanded="false" aria-label="Produto ERP de ${esc(l.inv)}"><div class="clist" hidden></div></div>${l.sku?`<span class="t2">SKU no anúncio: ${esc(l.sku)}</span>`:""}`}</td>
          <td class="r num">${l.mult} un</td><td class="r num">${n0(l.disponivel)}</td><td class="r num">${l.indisponivel?`<span title="${esc((l.detalhe||[]).map(d=>`${d.status}: ${d.quantity}`).join(", "))}">${n0(l.indisponivel)}</span>`:"—"}</td>
          <td class="r num">${l.cu===null?`<span class="t2">sem custo</span>`:BRL(l.custoDisp)}</td><td class="r num">${n0(l.vend)}</td><td class="r">${cobCel(l)}</td></tr>
          ${DB.mlInv===l.inv?`<tr class="mlhist"><td colspan="8">${mlHistHtml(l)}</td></tr>`:""}`).join("")||`<tr><td colspan="8" class="muted">${m.ativos.length?"Nada encontrado.":"Nenhum anúncio com estoque no Full. Clique em Sincronizar agora."}</td></tr>`}
      </tbody></table></div>${P.html}`;
  }
  const aviso=c.conectado&&c.offline===false?`<div class="lmsg err">Conexão temporária: o Mercado Livre não liberou o <b>acesso offline</b>, então ela vale só até ${c.expira?new Date(c.expira).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}):"algumas horas"}. No DevCenter, edite a aplicação, marque <b>offline_access</b> nas permissões, salve e clique em <button class="lnkbtn" data-act="ml-conectar">Conectar de novo</button>.</div>`:"";
  const carga=c.carga?`<div class="lmsg">Carregando o histórico do Mercado Livre: movimentações lidas até ${new Date(c.carga).toLocaleDateString("pt-BR")}, indo para trás. Vendas, entradas e cobertura ficam completas quando terminar (o Mercado Livre libera aos poucos).</div>`:"";
  return hdr+aviso+carga+`${c.msg?`<div class="lmsg err">${esc(c.msg)} <button class="lnkbtn" data-act="ml-conectar">Conectar de novo</button></div>`:""}
    <div class="sumrow">
      ${card(BRL(m.custoDisp),"custo disponível no Full",m.custoTot>m.custoDisp?`${BRL(m.custoTot)} com indisponíveis`:"")}
      ${card(n0(m.modelos),"modelos",`${n0(m.ativos.length)} anúncios`)}
      ${card(n0(m.pecas),"peças disponíveis",`${n0(m.unid)} unidades/kits${m.indisp?` · ${n0(m.indisp)} indisp.`:""}`)}
      ${card(m.cobMedia===null?"—":cobTxt(m.cobMedia),"cobertura média",`vendas dos últimos ${dias} dias${mlTeto()?` · picos acima de ${mlTeto()}× cortados`:""}`)}
    </div>
    <div class="sumrow">
      ${card(n0(m.ent),"entradas de abastecimento",`envios ao Full nos últimos ${dias} dias`)}${card(n0(m.dev),"unidades/kits devolvidos",`${c.devVendas!=null?`${n0(c.devVendas)} venda${c.devVendas===1?"":"s"} devolvida${c.devVendas===1?"":"s"} · `:""}${n0(m.devPecas)} peças · últimos ${dias} dias`)}${card(n0(m.vend),"vendas","unidades/kits")}
    </div>
    ${m.semVinc||m.semCusto?`<div class="lmsg">${m.semVinc?`${m.semVinc} anúncio${m.semVinc>1?"s":""} sem vínculo com produto do ERP (aba Vínculos). `:""}${m.semCusto?`${m.semCusto} anúncio${m.semCusto>1?"s":""} sem custo na planilha: ficam fora do custo total.`:""}</div>`:""}
    <div class="panel"><div class="fbar"><div class="busca2"><span aria-hidden="true">${LUPA}</span><input class="inp" id="mlQ" placeholder="Buscar anúncio, título, SKU ou modelo" value="${esc(DB.mlQ||"")}" aria-label="Buscar no estoque"></div>
      <div class="seg per" role="group" aria-label="Período da média de vendas">${per}</div>
      ${DB.mlCustom?`<form id="mlDiasF" class="mldias"><input class="inp" id="mlDias" type="number" min="1" max="365" value="${dias}" aria-label="Dias"><button class="btn btn-sm" type="submit">Aplicar</button></form>`:""}</div>
      <div class="fbar"><div class="seg" role="group" aria-label="Visão"><button aria-pressed="${!porModelo}" data-act="ml-visao" data-v="an">Por anúncio</button><button aria-pressed="${!!porModelo}" data-act="ml-visao" data-v="mod">Por modelo</button></div>
      ${porModelo?"":`<label class="muted">Ordenar por <select class="inp mlord" id="mlOrd">${[["cob","menor cobertura"],["custo","maior custo"],["vend","mais vendidos"],["disp","mais estoque"]].map(([k,t])=>`<option value="${k}" ${ord===k?"selected":""}>${t}</option>`).join("")}</select></label>`}
      <label class="muted">Pico: venda acima de <select class="inp mlord" id="mlTeto">${[[2,"2×"],[3,"3×"],[4,"4×"],[5,"5×"],[0,"sem corte"]].map(([k,t])=>`<option value="${k}" ${mlTeto()===k?"selected":""}>${t}</option>`).join("")}</select> o normal</label>
      <span class="muted">${c.custos?.length?`Custos: ${n0(c.custos.length)} SKUs${c.custos_em?` (${new Date(c.custos_em).toLocaleDateString("pt-BR")})`:""}`:"Suba a planilha de custos"}</span></div>
      ${corpo}</div>`;
}

const mlRef=(o,t)=>{ const r=(o.ref||[])[0]; if(!r) return ""; return r.type==="inbound_id"?`envio ao Full nº ${r.value}`:r.type==="shipment_id"?(t==="sale_confirmation"||t==="sale_cancelation"?`venda · envio ${r.value}`:`envio ${r.value}`):`${r.type} ${r.value}`; };
/* recebimentos do mesmo envio ao Full (o ML confere em partes) viram uma linha só */
function mlAgrupa(ops){ const out=[];
  ops.forEach(o=>{ const ref=(o.ref||[])[0], k=o.tipo==="inbound_reception"&&ref?.type==="inbound_id"?ref.value:null;
    const g=k&&out.find(x=>x.k===k);
    if(g){ g.disp+=o.disp||0; g.indisp+=o.indisp||0; g.n++; g.ini=o.data; } else out.push({...o,k,n:1,ini:o.data,fim:o.data,disp:o.disp||0,indisp:o.indisp||0}); });
  return out; }
function mlHistHtml(l){ const h=DB.mlHist&&DB.mlHist.inv===l.inv?DB.mlHist:null;
  if(!h) return `<span class="muted">Carregando histórico…</span>`;
  if(!h.ops.length) return `<span class="muted">Nenhuma movimentação registrada ainda.</span>`;
  const dt=d=>new Date(d).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
  const ops=mlAgrupa(h.ops);
  return `<div class="mlh"><b>Histórico de ${esc(l.inv)}</b><table class="t"><thead><tr><th>Data</th><th>Movimento</th><th>Origem</th><th class="r">Disponível</th><th class="r">Indisp.</th><th class="r">Saldo</th></tr></thead><tbody>
    ${ops.slice(0,200).map(o=>{ const g=ML_GRUPO[o.tipo]; return `<tr><td class="num">${o.n>1&&o.ini!==o.fim?`${dt(o.ini)}<div class="t2">até ${dt(o.fim)}</div>`:dt(o.fim)}</td>
      <td><span class="mlt ${g||""}">${esc(ML_TIPOS[o.tipo]||o.tipo)}</span>${o.n>1?`<div class="t2">${o.n} conferências do mesmo envio</div>`:""}</td><td class="t2">${esc(mlRef(o,o.tipo))}</td>
      <td class="r num ${o.disp>0?"okmark":o.disp<0?"neg":""}">${o.disp>0?"+":""}${o.disp||"—"}</td><td class="r num">${o.indisp||"—"}</td><td class="r num">${o.saldo??"—"}</td></tr>`; }).join("")}
    </tbody></table>${ops.length>200?`<span class="muted">Mostrando as 200 mais recentes.</span>`:""}</div>`; }

/* planilha de custos: SKU + custo (aceita .xlsx e .csv) */
async function lerCustos(input){ const f=input.files[0]; input.value=""; if(!f) return;
  toast("Lendo planilha…");
  try{ let rows;
    if(/\.csv$/i.test(f.name)){ const t=await f.text(); const sep=(t.split("\n")[0].match(/;/g)||[]).length>(t.split("\n")[0].match(/,/g)||[]).length?";":",";
      rows=t.split(/\r?\n/).filter(Boolean).map(l=>l.split(sep).map(x=>x.replace(/^"|"$/g,"").trim())); }
    else { if(!window.XLSX) await new Promise((ok,er)=>{ const sc=document.createElement("script"); sc.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; sc.onload=ok; sc.onerror=()=>er(new Error("leitor de planilha não carregou")); document.head.appendChild(sc); }); const wb=XLSX.read(await f.arrayBuffer(),{type:"array"}); rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,raw:true}); }
    const h=(rows[0]||[]).map(x=>String(x||"").toLowerCase());
    const iS=h.findIndex(x=>/sku|c[oó]d/.test(x)), iC=h.findIndex(x=>/custo|pre[cç]o/.test(x)), iD=h.findIndex(x=>/descri/.test(x));
    if(iS<0||iC<0) throw new Error("não achei as colunas SKU e Custo");
    const num=v=>typeof v==="number"?v:parseFloat(String(v||"").replace(/[R$\s.]/g,"").replace(",","."));
    const itens=rows.slice(1).map(r=>({cod:String(r[iS]??"").trim(),descricao:iD>=0?String(r[iD]??""):"",custo:num(r[iC])})).filter(x=>x.cod&&isFinite(x.custo));
    if(!itens.length) throw new Error("nenhuma linha com SKU e custo");
    const r=await api("custos",{itens}); toast(`Custos atualizados · ${n0(r.n)} SKUs`); await mlCarregar();
  }catch(x){ toast(`Planilha não reconhecida: ${x.message}`); console.warn(x); }
}

/* popup: como a cobertura é calculada */
function cobAjudaHtml(){ const c=DB.ml||{}, dias=c.dias||30, K=mlTeto();
  return `<div class="mdl" data-act="ajudax"><div class="mdlc cobaj" role="dialog" aria-modal="true" aria-labelledby="cobT" data-stop="1">
  <div class="mdlh"><div><span class="eyebrow">Ajuda</span><h3 id="cobT">Como a cobertura é calculada</h3></div><button class="hbtn" data-act="ajudax" aria-label="Fechar">×</button></div>
  <p>A cobertura diz <b>quantos dias o estoque disponível no Full dura</b> no ritmo de venda atual.</p>
  <div class="cobf">Cobertura = disponível no Full ÷ vendas por dia</div>
  <ol class="cobl">
    <li><b>Vendas por dia</b>: soma das vendas do anúncio nos últimos <b>${dias} dias</b> (período escolhido no topo), menos as vendas canceladas, dividida por ${dias}.</li>
    <li><b>Corte de picos</b>: para cada anúncio, o sistema calcula o <b>tamanho normal de uma venda</b> (a mediana das vendas dos últimos 180 dias). ${K?`Uma venda maior que <b>${K}× esse normal</b> conta só até esse teto, para um pedido grande isolado não derrubar a cobertura.`:`O corte está <b>desligado</b>: todas as vendas contam pelo valor cheio.`} Ajuste em “Pico: venda acima de…”.</li>
    <li><b>⚡ Pico</b>: o anúncio teve venda acima do teto. Passe o mouse na cobertura para ver as vendas cortadas e quanto daria sem o corte.</li>
    <li><b>Esporádica</b>: só 1 ou 2 vendas no período. Pouca venda não dá uma projeção confiável, então o número de dias não é mostrado e o anúncio fica fora da cobertura média.</li>
    <li><b>Sem venda</b>: nenhuma venda no período.</li>
  </ol>
  <div class="cobex"><b>Exemplo</b> (teto ${K||3}×): normal de 2 peças por venda, vendas de 2, 1, 2 e 20 em 30 dias, 15 disponíveis.<br>
    Sem corte: 25 ÷ 30 = 0,83 por dia → <b>18 dias</b>. Com corte: a venda de 20 conta como ${2*(K||3)} → ${5+2*(K||3)} ÷ 30 = ${((5+2*(K||3))/30).toFixed(2).replace(".",",")} por dia → <b>${Math.round(15/((5+2*(K||3))/30))} dias</b> ⚡.</div>
  <p class="hint"><b>Cores:</b> laranja abaixo de 15 dias (repor), verde entre 15 e 90 dias, vermelho acima de 90 dias (estoque parado). A <b>cobertura média</b> do topo pondera cada anúncio pelo custo do estoque disponível.</p>
  </div></div>`; }
