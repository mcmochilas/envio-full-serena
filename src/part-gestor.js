/* ===== GESTOR ===== */
const TABS=[["envios","Envios"],["vinculos","Vínculos"],["usuarios","Usuários"]];
function allAnuncios(){ return [...new Map(DB.envios.flatMap(e=>e.anuncios).map(a=>[a.inv,a])).values()]; }
function renderGestor(){
  const pend=allAnuncios().filter(a=>!V(a.inv).cod).length;
  $("#app").innerHTML=`<div class="ad"><nav aria-label="Seções">
    <div style="padding:0 8px;display:flex;flex-direction:column;gap:8px"><img src="${LOGO.escuro}" alt="Serena Puxadores" style="width:150px;height:auto;display:block"><small style="font-family:var(--display);font-weight:700;letter-spacing:.2em;text-transform:uppercase;font-size:10px;color:var(--gold)">Gestão Envios Full</small></div>
    <div style="display:flex;flex-direction:column;gap:4px">${TABS.map(([k,l])=>{ const b=k==="vinculos"?pend:DB.envios.filter(e=>e.status==="rascunho").length;
      return `<button class="navb" data-act="tab" data-t="${k}" aria-current="${DB.tab===k?"page":"false"}"><span>${l}</span>${b?`<span class="badge">${b}</span>`:""}</button>`; }).join("")}</div>
    <div class="navfoot"><button class="navlink" data-act="to-exp">Abrir app da expedição</button><button class="navlink" data-act="logout">Sair</button></div>
  </nav><main>${DB.tab==="vinculos"?gVinc():DB.tab==="usuarios"?gUsers():gEnvios()}</main></div>`;
}
const PER=[["todos","Todos"],["hoje","Hoje"],["7","7 dias"],["30","30 dias"],["mes","Este mês"],["custom","Personalizado"]];
const dfmt=t=>new Date(t).toLocaleDateString("pt-BR",{day:"2-digit",month:"2-digit",year:"2-digit"});
const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
function periodo(){ const F=DB.f||{}, d0=new Date(); d0.setHours(0,0,0,0); const dia=864e5;
  switch(F.per){ case "hoje": return [d0.getTime(),Infinity]; case "7": return [d0.getTime()-6*dia,Infinity]; case "30": return [d0.getTime()-29*dia,Infinity];
    case "mes": return [new Date(d0.getFullYear(),d0.getMonth(),1).getTime(),Infinity];
    case "custom": return [F.de?new Date(F.de+"T00:00").getTime():-Infinity, F.ate?new Date(F.ate+"T23:59:59").getTime():Infinity];
    default: return [-Infinity,Infinity]; } }
function achou(e,q){ if(!q) return ""; if(norm(e.id).includes(q)||(e.pvs||[]).some(p=>norm(p).includes(q))) return "";
  const c=Object.keys(e.pre).concat(e.anuncios.map(a=>V(a.inv).cod)).find(c=>c&&(norm(c).includes(q)||norm(nomeCod(c)).includes(q)));
  if(c) return `${c} · ${nomeCod(c)}`; const a=e.anuncios.find(a=>norm(a.inv).includes(q)||norm(a.titulo).includes(q)); return a?`${a.inv} · ${a.titulo}`:null; }
function pager(key,total,PG){ const pages=Math.max(1,Math.ceil(total/PG)); DB.pg=DB.pg||{}; const p=Math.min(Math.max(1,DB.pg[key]||1),pages); DB.pg[key]=p; const ini=(p-1)*PG;
  const nums=[]; for(let i=1;i<=pages;i++) if(i===1||i===pages||Math.abs(i-p)<=1) nums.push(i); else if(nums[nums.length-1]!=="…") nums.push("…");
  return {ini,fim:ini+PG,html:total<=PG?`<span class="muted">${total} registro${total===1?"":"s"}</span>`:`<div class="pag"><span class="muted">${ini+1}–${Math.min(ini+PG,total)} de ${total}</span><div class="acts">
    <button class="btn btn-sm" data-act="pg" data-k="${key}" data-p="${p-1}" ${p<=1?"disabled":""}>‹ Anterior</button>
    ${nums.map(n=>n==="…"?`<span class="muted">…</span>`:`<button class="btn btn-sm ${n===p?"btn-dark":""}" data-act="pg" data-k="${key}" data-p="${n}" aria-current="${n===p?"page":"false"}">${n}</button>`).join("")}
    <button class="btn btn-sm" data-act="pg" data-k="${key}" data-p="${p+1}" ${p>=pages?"disabled":""}>Próxima ›</button></div></div>`}; }
const XSVG=`<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
function delBtn(e){ const pend=DB.delPend&&DB.delPend.id===e.id&&Date.now()-DB.delPend.t<6000;
  const aviso=e.status==="rascunho"?"":e.status==="liberado"?" A separação e as etiquetas já registradas serão perdidas.":" O histórico deste envio será apagado.";
  return pend?`<button class="xdel on" data-act="delenv" data-id="${e.id}" title="Confirmar exclusão do envio #${e.id}.${aviso}">${XSVG}<span>Excluir?</span></button>`
    :`<button class="xdel" data-act="delenv" data-id="${e.id}" title="Excluir envio #${e.id}" aria-label="Excluir envio #${e.id}">${XSVG}</button>`; }
const LAPIS=`<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true"><path d="M11.2 2.3a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L6 12.5 2.5 13.5l1-3.5z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
function anCel(e,a,mult){ const ed=DB.edAn; const txt=mult===1?"1 (unidade)":mult;
  if(ed&&ed.id===e.id&&ed.inv===a.inv)
    return `<form class="anEd" data-id="${e.id}" data-inv="${esc(a.inv)}"><input class="inp" id="anEdIn" type="number" min="1" max="999" step="1" value="${mult}" aria-label="Peças por kit do anúncio ${esc(a.inv)}"><button class="ebtn ok" type="submit" title="Salvar" aria-label="Salvar">✓</button><button class="ebtn" type="button" data-act="anEdX" title="Cancelar" aria-label="Cancelar">×</button></form>`;
  return `<span class="anv">${txt}<button class="pen" data-act="anEd" data-id="${e.id}" data-inv="${esc(a.inv)}" title="Editar peças por kit" aria-label="Editar peças por kit do anúncio ${esc(a.inv)}">${LAPIS}</button></span>`; }
function gEnviosList(){
  const F=DB.f||(DB.f={per:"todos",q:""}); const [a,b]=periodo(); const q=norm(F.q).trim();
  const lst=DB.envios.filter(e=>(e.criado||0)>=a&&(e.criado||0)<=b).map(e=>({e,m:achou(e,q)})).filter(x=>x.m!==null).sort((x,y)=>(y.e.criado||0)-(x.e.criado||0));
  const P=pager("envios",lst.length,10);
  return `<div class="tbox"><table class="t"><thead><tr><th>Envio</th><th>Criado</th><th>Pré-vendas</th><th class="r">Anúncios</th><th class="r">Etiquetas</th><th class="r">Peças</th><th>Situação</th><th class="xcol"></th></tr></thead><tbody>
  ${lst.slice(P.ini,P.fim).map(({e,m})=>`<tr class="clk ${DB.sel===e.id?"flag":""}" data-act="sel" data-id="${e.id}"><td class="mono">#${e.id}${m?`<div class="hit">${LUPA} ${esc(m)}</div>`:""}</td><td class="num">${e.criado?dfmt(e.criado):"—"}</td><td class="mono">${(e.pvs||[]).join(" · ")}</td><td class="r num">${e.anuncios.length}</td><td class="r num">${tot(e)}</td><td class="r num">${conf(e).pecas}</td><td><div class="tags">${statusTag(e)}${manualTag(e)}</div></td><td class="xcol">${delBtn(e)}</td></tr>`).join("")||`<tr><td colspan="8" class="muted">Nenhum envio encontrado para esse filtro.</td></tr>`}
  </tbody></table></div>${P.html}`;
}
function gEnvios(){
  const sel=DB.sel==="novo"?null:env(DB.sel); const F=DB.f||(DB.f={per:"todos",q:""});
  return `<div class="hdr"><div><span class="eyebrow">Mercado Livre · Full</span><h1>Envios</h1></div><button class="btn btn-dark" data-act="novo">Importar envio</button></div>
  <div class="filtros">
    <div class="busca2"><span aria-hidden="true">${LUPA}</span><input class="inp" id="fq" value="${esc(F.q)}" placeholder="Buscar nº do envio, pré-venda, SKU ou descrição do produto" autocomplete="off" aria-label="Buscar envios"></div>
    <div class="seg per" role="group" aria-label="Período">${PER.map(([k,l])=>`<button data-act="per" data-p="${k}" aria-pressed="${F.per===k}">${l}</button>`).join("")}</div>
    ${F.per==="custom"?`<div class="datas"><label>De <input class="inp" type="date" id="fde" value="${esc(F.de||"")}"></label><label>Até <input class="inp" type="date" id="fate" value="${esc(F.ate||"")}"></label></div>`:""}
  </div>
  <div id="elist">${gEnviosList()}</div>
  ${DB.sel==="novo"?gNovo():sel?gDet(sel):""}`;
}
function gNovo(){
  const I=DB.imp;
  return `<div class="box"><h2>Importar envio</h2>
  <p class="hint">Suba os arquivos de etiquetas que o Mercado Livre gerou para a impressora térmica (.txt, pode ser mais de um) e as pré-vendas do ERP em PDF (uma ou várias para o mesmo envio).</p>
  <div class="grid2" style="gap:12px">
   <label class="drop" for="fEtq"><b>Etiquetas do Mercado Livre</b><span>Arquivos .txt (ZPL) · ${I?.nEtqFiles?`${I.nEtqFiles} arquivo(s) lido(s)`:"clique para escolher"}</span><input type="file" id="fEtq" accept=".txt,.zpl,text/plain" multiple></label>
   <label class="drop" for="fPdf"><b>Pré-vendas do ERP</b><span>Arquivos PDF · ${I?.pvs?.length?`${I.pvs.length} pré-venda(s) lida(s)`:"clique para escolher"}</span><input type="file" id="fPdf" accept="application/pdf,.pdf" multiple></label>
  </div>
  ${I?.msg?`<div class="err">${esc(I.msg)}</div>`:""}
  ${I&&I.anuncios?.length?(()=>{ const auto=I.anuncios.filter(a=>I.vinc[a.inv]?.cod).length; const pecasPre=Object.values(I.pre).reduce((s,o)=>s+Object.values(o).reduce((a,b)=>a+b,0),0);
    return `<div class="sumrow">
      <div class="sum"><b class="mono" style="font-size:20px">#${esc(I.id)}</b><span>envio</span></div>
      <div class="sum"><b class="num">${I.anuncios.length}</b><span>anúncios · ${I.anuncios.reduce((s,a)=>s+a.etiquetas,0)} etiquetas</span></div>
      <div class="sum"><b class="num">${pecasPre}</b><span>peças em ${I.pvs.length} pré-venda(s)</span></div>
      <div class="sum ${auto<I.anuncios.length?"hl":""}"><b class="num">${auto}/${I.anuncios.length}</b><span>vínculos reconhecidos</span></div></div>
      ${env(I.id)?`<div class="note warn"><span>O envio #${esc(I.id)} já existe no app. Importar de novo substitui os dados e zera o progresso dele.</span></div>`:""}
      <div class="acts"><button class="btn btn-dark" data-act="criar">${env(I.id)?"Substituir envio":"Criar envio"}</button><button class="btn" data-act="sel" data-id="">Cancelar</button></div>`; })():""}
  </div>`;
}
function gDet(e){
  const pv=pendVinc(e); const c=conf(e);
  return `<div class="box"><div class="hdr"><div><span class="eyebrow">Envio #${e.id} · pré-vendas ${(e.pvs||[]).join(", ")}</span><h2 style="font-size:20px">${conf(e).pecas} peças · ${tot(e)} etiquetas</h2></div><div class="tags">${statusTag(e)}${manualTag(e)}</div></div>
  ${pv.length?`<div class="note warn"><span>${pv.length} anúncio${pv.length>1?"s":""} sem vínculo com o ERP. A expedição só recebe o envio depois disso.</span><button class="lnk" data-act="tab" data-t="vinculos">Vincular agora</button></div>`
   :e.status==="rascunho"?`<div class="note ok"><span>Tudo vinculado.${c.div.length?` A conferência vai mostrar ${c.div.length} diferença${c.div.length>1?"s":""} para a expedição.`:" Pré-venda e envio batem."}</span><button class="btn btn-dark btn-sm" data-act="liberar" data-id="${e.id}">Liberar para a expedição</button></div>`:""}
  ${!pv.length&&c.div.length?`<div class="tbox" style="border:1px solid var(--line2)"><table class="t"><thead><tr><th>Diferença entre envio e pré-venda</th><th class="r">Envio</th><th class="r">Pré-venda</th><th class="r">Ação</th></tr></thead><tbody>${c.div.map(r=>`<tr><td><span class="mono">${r.cod}</span> · ${esc(nomeCod(r.cod))}</td><td class="r num">${r.x.pecas}</td><td class="r num">${r.p}</td><td class="r">${r.d<0&&e.status!=="concluido"?`<button class="btn btn-sm" data-act="addpre" data-id="${e.id}" data-cod="${r.cod}">${LUPA} Adicionar ${-r.d} à pré-venda</button>`:`<span class="muted">sobram ${r.d} na pré-venda</span>`}</td></tr>`).join("")}</tbody></table></div>`:""}
  ${Object.keys(e.manual||{}).length?`<div class="manbox"><div class="mhd">${LUPA} <b>Itens adicionados manualmente à pré-venda</b></div>
    ${Object.entries(e.manual).map(([cod,x])=>`<div class="mrow"><span><span class="mono">${cod}</span> · ${esc(nomeCod(cod))} · <b>+${x.qtd} peças</b><br><span class="muted">por ${esc(nomeU(x.por))} em ${esc(new Date(x.em).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}))} · lembre de lançar também no ERP</span></span>${e.status!=="concluido"?`<button class="btn btn-sm" data-act="rmpre" data-id="${e.id}" data-cod="${cod}">Remover</button>`:""}</div>`).join("")}</div>`:""}
  <details class="oklist" ${DB.openAn===e.id?"open":""} data-an="${e.id}"><summary>Ver os ${e.anuncios.length} anúncios</summary>
  <div class="tbox" style="border:1px solid var(--line2);margin-top:8px"><table class="t"><thead><tr><th>Anúncio</th><th>Título no ML</th><th class="r">Etiquetas</th><th>Produto ERP</th><th class="r">Peças por kit</th><th class="r">Peças</th></tr></thead><tbody>
  ${(()=>{ const P=pager("an-"+e.id,e.anuncios.length,15); DB._p=P; return e.anuncios.slice(P.ini,P.fim).map(a=>{const v=V(a.inv);return `<tr class="${v.cod?"":"flag"}"><td class="mono">${esc(a.inv)}</td><td>${esc(a.titulo)}</td><td class="r num">${a.etiquetas}</td><td>${v.cod?`${v.cod} · ${esc(nomeCod(v.cod))}`:`<span class="tag tag-warn">sem vínculo</span>`}</td><td class="r num">${v.cod?anCel(e,a,v.mult):"—"}</td><td class="r num">${v.cod?a.etiquetas*v.mult:"—"}</td></tr>`;}).join(""); })()}
  </tbody></table></div><div style="margin-top:8px">${DB._p.html}</div></details>
  ${e.status==="concluido"?`<p class="hint">Concluído pela expedição.</p>`:""}
  ${e.status==="rascunho"?`<div class="acts"><button class="lnkbtn" data-act="excluir" data-id="${e.id}" style="color:var(--err)">Excluir este rascunho</button></div>`:""}
  </div>`;
}
function gVinc(){
  const invs=allAnuncios().sort((a,b)=>(!!V(a.inv).cod)-(!!V(b.inv).cod)||a.titulo.localeCompare(b.titulo));
  const pend=invs.filter(a=>!V(a.inv).cod).length;
  const PG=15, pages=Math.max(1,Math.ceil(invs.length/PG)); DB.vpg=Math.min(Math.max(1,DB.vpg||1),pages);
  const ini=(DB.vpg-1)*PG, pagina=invs.slice(ini,ini+PG);
  return `<div class="hdr"><div><span class="eyebrow">Cadastro único</span><h1>Vínculos anúncio × produto</h1></div></div>
  <p class="hint" style="max-width:72ch">Cada anúncio Full aponta para um código do ERP e diz quantas peças uma etiqueta representa. Quando a etiqueta traz o SKU do ERP o app vincula sozinho; anúncios com “Universal Code” ou SKU diferente do ERP você vincula uma vez e fica salvo. Título “4x …” ou SKU “-010” já sugerem as peças do kit.</p>
  ${pend?`<div class="note warn"><span>${pend} anúncio${pend>1?"s":""} aguardando vínculo.</span></div>`:`<div class="note ok"><span>Todos os anúncios estão vinculados.</span></div>`}
  <div class="tbox"><table class="t"><thead><tr><th>Anúncio</th><th>Título no ML</th><th>Referência na etiqueta</th><th>Produto ERP</th><th class="r">Peças/etiqueta</th></tr></thead><tbody>
  ${pagina.map(a=>{const v=V(a.inv);return `<tr class="${v.cod?"":"flag"}"><td class="mono">${esc(a.inv)}</td><td>${esc(a.titulo)}</td><td class="mono" style="font-size:12px">${esc(a.ref||"")}</td>
   <td><div class="combo"><input class="inp" data-vq="${esc(a.inv)}" value="${v.cod?esc(v.cod+" · "+nomeCod(v.cod)):""}" placeholder="Buscar por SKU ou descrição…" autocomplete="off" role="combobox" aria-expanded="false" aria-label="Produto ERP de ${esc(a.inv)}"><div class="clist" hidden></div></div></td>
   <td class="r"><input class="inp" type="number" min="1" data-vm="${esc(a.inv)}" value="${v.mult}" style="width:76px;height:40px;font-size:14px" aria-label="Peças por etiqueta de ${esc(a.inv)}"></td></tr>`;}).join("")}
  </tbody></table></div>
  <div class="pag"><span class="muted">${ini+1}–${Math.min(ini+PG,invs.length)} de ${invs.length} anúncios</span>
    <div class="acts"><button class="btn btn-sm" data-act="vpg" data-p="${DB.vpg-1}" ${DB.vpg<=1?"disabled":""}>‹ Anterior</button>
    ${Array.from({length:pages},(_,i)=>`<button class="btn btn-sm ${i+1===DB.vpg?"btn-dark":""}" data-act="vpg" data-p="${i+1}" aria-current="${i+1===DB.vpg?"page":"false"}">${i+1}</button>`).join("")}
    <button class="btn btn-sm" data-act="vpg" data-p="${DB.vpg+1}" ${DB.vpg>=pages?"disabled":""}>Próxima ›</button></div></div>`;
}
let BUSCA_T=null;
function comboBusca(inp){
  const raw=inp.value.trim(), q=raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,""); const box=inp.nextElementSibling; const inv=inp.dataset.vq;
  const loc=Object.keys(DB.erp).filter(c=>!q||(c+" "+nomeCod(c)).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(q)).sort((a,b)=>nomeCod(a).localeCompare(nomeCod(b))).slice(0,8).map(c=>({cod:c,nome:nomeCod(c)}));
  const desenha=(lst,busca)=>{ box.innerHTML=(lst.length?lst.map((p,i)=>`<button type="button" class="copt${i===0?" on":""}" data-pick="${esc(p.cod)}" data-inv="${esc(inv)}"><b class="mono">${esc(p.cod)}</b> ${esc(p.nome)}</button>`).join(""):`<div class="muted" style="padding:8px 10px">${busca?"Buscando no cadastro…":"Nenhum produto encontrado"}</div>`)+(busca&&lst.length?`<div class="muted" style="padding:6px 10px;font-size:12px">Buscando também no cadastro completo…</div>`:""); box.hidden=false; inp.setAttribute("aria-expanded","true"); };
  desenha(loc,q.length>=2);
  clearTimeout(BUSCA_T); if(q.length<2) return;
  BUSCA_T=setTimeout(async()=>{ try{ const r=await api("prod",{q:raw}); if(inp.value.trim()!==raw||document.activeElement!==inp) return; const m=new Map(loc.map(p=>[p.cod,p])); r.itens.forEach(p=>{ if(!m.has(p.cod)) m.set(p.cod,p); }); desenha([...m.values()].slice(0,10),false); }catch(e){ desenha(loc,false); } },300);
}
async function lerArquivos(input){
  const I=DB.imp||(DB.imp={anuncios:[],pre:{},pvs:[],vinc:{},erpNovos:{}});
  I.msg=null;
  try{
    if(input.id==="fEtq"){
      const map=new Map(); let id=I.id;
      for(const f of input.files){ const m=f.name.match(/Envio-(\d+)/); if(m) id=m[1];
        parseZPL(await f.text()).forEach(a=>{ const x=map.get(a.inv); if(x) x.etiquetas+=a.etiquetas; else map.set(a.inv,a); }); }
      if(!map.size){ I.msg="Não encontrei etiquetas nesses arquivos. Use os .txt da impressora térmica que o Mercado Livre gera."; }
      I.anuncios=[...map.values()]; I.id=id||String(Date.now()).slice(-8); I.nEtqFiles=input.files.length;
    } else {
      if(!window.pdfjsLib){ I.msg="O leitor de PDF não carregou. Verifique a conexão e tente de novo."; render(); return; }
      pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      I.pre={}; I.pvs=[]; I.erpNovos={};
      for(const f of input.files){ const lines=await pdfLines(pdfjsLib,new Uint8Array(await f.arrayBuffer())); const r=parsePrevendaLines(lines);
        if(!r.itens.length){ I.msg=`Não reconheci itens em ${f.name}.`; continue; }
        const pv=r.pv||f.name; I.pvs.push(pv);
        r.itens.forEach(it=>{ (I.pre[it.cod]=I.pre[it.cod]||{})[pv]=((I.pre[it.cod]||{})[pv]||0)+it.qtd; I.erpNovos[it.cod]={nome:it.nome,ean:it.ean}; }); }
    }
    I.vinc={}; I.anuncios.forEach(a=>{ if(DB.vinc[a.inv]?.cod){ I.vinc[a.inv]=DB.vinc[a.inv]; return; } const s=sugestaoVinc(a); I.vinc[a.inv]={cod:(DB.erp[s.cod]||I.erpNovos[s.cod])?s.cod:"",mult:s.mult}; });
  }catch(x){ I.msg="Não consegui ler o arquivo: "+x.message; }
  save(); render();
}

function gUsers(){
  const us=Object.values(DB.users).sort((a,b)=>(b.ativo!==false)-(a.ativo!==false)||a.nome.localeCompare(b.nome)); const ed=DB.uEdit;
  const P=pager("users",us.length,15);
  return `<div class="hdr"><div><span class="eyebrow">Acesso</span><h1>Usuários</h1></div><button class="btn btn-dark" data-act="uNovo">Novo usuário</button></div>
  <p class="hint" style="max-width:70ch">Gestor importa envios, cuida dos vínculos e libera para a expedição. Expedição separa pelo celular (pelo QR, sem login) e etiqueta no computador. Todos entram no computador com login e PIN de 4 números.</p>
  ${ed?`<form class="box" id="uForm" autocomplete="off"><h2>${ed.novo?"Novo usuário":"Editar "+esc(ed.nome)}</h2>
    <div class="ugrid">
      <div class="fld"><label for="uLogin">Login</label><input class="inp" id="uLogin" value="${esc(ed.login||"")}" ${ed.novo?"":"readonly"} placeholder="ex.: ana" autocapitalize="none"></div>
      <div class="fld"><label for="uNome">Nome</label><input class="inp" id="uNome" value="${esc(ed.nome||"")}" placeholder="Nome que aparece no app"></div>
      <div class="fld"><label for="uRole">Perfil</label><select class="inp" id="uRole" style="height:46px"><option value="expedicao" ${ed.role!=="gestor"?"selected":""}>Expedição</option><option value="gestor" ${ed.role==="gestor"?"selected":""}>Gestor</option></select></div>
      <div class="fld"><label for="uPin">${ed.novo?"PIN (4 números)":"Novo PIN (deixe em branco para manter)"}</label><input class="inp" id="uPin" inputmode="numeric" maxlength="4" pattern="[0-9]*"></div>
    </div>
    <label class="hint" style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="uAtivo" ${ed.ativo!==false?"checked":""}> Ativo</label>
    <div class="acts"><button class="btn btn-dark" type="submit">Salvar</button><button class="btn" type="button" data-act="uCancel">Cancelar</button></div></form>`:""}
  <div class="tbox"><table class="t"><thead><tr><th>Nome</th><th>Login</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
  ${us.slice(P.ini,P.fim).map(u=>`<tr><td>${esc(u.nome)}</td><td class="mono">${esc(u.login)}</td><td>${u.role==="gestor"?"Gestor":"Expedição"}</td><td>${u.ativo!==false?`<span class="tag tag-ok">Ativo</span>`:`<span class="tag tag-off">Inativo</span>`}</td><td class="r"><button class="btn btn-sm" data-act="uEdit" data-u="${esc(u.login)}">Editar</button></td></tr>`).join("")}
  </tbody></table></div>${P.html}`;
}
