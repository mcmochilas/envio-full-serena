/* ===== EXPEDIÇÃO ===== */
let FOCUS=null;
function xTop(sub,back){
  const me=DB.me;
  return `<div class="xtop">${back?`<button class="xbtn" data-act="home" aria-label="Voltar para a lista">← Envios</button>`:""}<img src="${LOGO.escuro}" alt="Serena Puxadores"><small>${sub}</small><span class="sp"></span>
  ${ROLE()==="gestor"?`<button class="xbtn" data-act="to-gestor" style="background:#F7F4EF;color:#0F3A4E;border:0">Painel do gestor</button>`:""}
  <span class="who">${esc(nomeU(me))}</span>
  <label style="color:#B7CAD4;display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" id="snd" ${DB.mute?"":"checked"}> Som</label>
  <button class="xbtn" data-act="logout">Sair</button></div>`;
}
function renderExp(){
  if(DB.mobile) return renderPhoneFull();
  const e=DB.cur&&env(DB.cur);
  if(!e) return renderFila();
  $("#app").innerHTML=`<div class="ex">${xTop(`Envio <span class="mono">#${e.id}</span>`,true)}<div class="xbody">${xWork(e)}</div></div>`;
  drawQR(e);
  runMaps();
  if(FOCUS){ const f=document.getElementById(FOCUS); if(f) f.focus(); }
}
function renderFila(){
  const fila=DB.envios.filter(e=>e.status==="liberado"), done=DB.envios.filter(e=>e.status==="concluido");
  const card=e=>{ const its=itens(e), et=its.filter(i=>i.s.status==="etiquetado").length;
    return `<div class="ecard"><div><span class="eyebrow">${e.criado?"Criado em "+dfmt(e.criado):""}</span><h2>Envio <span class="mono" style="font-weight:500">#${e.id}</span></h2>
    <span class="muted">${its.length} produtos · ${conf(e).pecas} peças · ${tot(e)} etiquetas</span></div>
    ${e.status==="concluido"?`<span class="tag tag-ok">Concluído</span>`:`<button class="btn btn-dark" data-act="abrir" data-id="${e.id}">${its.some(i=>i.s.status!=="livre")?"Entrar no envio":"Preparar"}</button>`}
    <div class="bar"><i class="${et===its.length?"full":""}" style="width:${its.length?Math.round(et/its.length*100):0}%"></i></div></div>`; };
  $("#app").innerHTML=`<div class="ex">${xTop("Preparação de envios Full")}<div class="xbody">
    <h1 style="font-size:26px">Envios para preparar</h1>
    ${fila.length?fila.map(card).join(""):`<div class="hero"><h2>Nenhum envio na fila</h2><p class="hint">Quando o gestor liberar um envio, ele aparece aqui.</p></div>`}
    ${done.length?(()=>{ done.sort((a,b)=>(b.criado||0)-(a.criado||0)); const P=pager("fila",done.length,8); return `<h2 style="font-size:17px;margin-top:10px;color:var(--muted)">Concluídos</h2>${done.slice(P.ini,P.fim).map(card).join("")}${P.html}`; })():""}
  </div></div>`;
}
function xConf(e){
  const c=conf(e);
  if(!c.div.length) return `<div class="hero"><span class="eyebrow">Antes de começar</span><h1>Pré-venda e envio batem</h1>
    <p class="hint" style="font-size:15px">${c.rows.length} produtos · ${c.pecas} peças · ${tot(e)} etiquetas.</p>
    <div class="acts"><button class="btn btn-dark" data-act="conferir" style="height:52px">Começar a separação</button></div></div>`;
  return `<div class="hero"><span class="eyebrow">Antes de começar</span><h1>${c.div.length} produto${c.div.length>1?"s":""} com diferença</h1>
   ${c.div.map(r=>`<div class="diff"><b>${esc(nomeCod(r.cod))}</b><span>Envio pede <b>${r.x.pecas}</b> · pré-venda tem <b>${r.p}</b> → ${r.d>0?`sobram ${r.d} peças na pré-venda`:`faltam ${-r.d} peças na pré-venda`}</span></div>`).join("")}
   <div class="fld" style="max-width:560px"><label for="mot">O que vai ser feito com a diferença?</label><input class="inp" id="mot" placeholder="Ex.: 2 peças voltam ao estoque" value="${esc(e.motivo)}"></div>
   <span class="err" id="motErr" hidden>Escreva o que vai ser feito para seguir.</span>
   <div class="acts"><button class="btn btn-dark" data-act="conferir" style="height:52px">Registrar e começar a separação</button></div></div>`;
}

/* --- bancada do computador --- */
function xWork(e){
  const its=itens(e); const cnt=k=>its.filter(i=>i.s.status===k).length;
  /* cada pessoa vê os itens livres + os que ela mesma pegou; o gestor pode ver todos */
  const eu=DB.me, todos=ROLE()==="gestor"&&DB.verTodos;
  const meu=i=>i.s.status==="livre"||i.s.resp===eu||todos;
  const vis=its.filter(meu);
  const prontos=vis.filter(i=>(i.s.status==="coletado"||i.s.status==="impresso"));
  const fim=tudoEtiquetado(e);
  return `<div class="work"><div class="col">
    <div class="sumrow">
      <div class="sum"><b class="num">${cnt("livre")}</b><span>para buscar</span></div>
      <div class="sum"><b class="num">${its.reduce((t,i)=>t+kitsDe(i).n,0)}</b><span>kits no envio</span></div>
      <div class="sum"><b class="num">${vis.filter(i=>i.s.status==="separando").length}</b><span>${todos?"sendo separados":"com você"}</span></div>
      <div class="sum hl"><b class="num">${prontos.length}</b><span>prontos p/ etiquetar</span></div>
      <div class="sum"><b class="num">${etqDone(e)}/${tot(e)}</b><span>etiquetas coladas</span></div>
    </div>
    ${fim?`<div class="hero" style="border-top:4px solid var(--gold)"><span class="eyebrow">Tudo pronto</span><h1>Todos os produtos foram etiquetados</h1>
      <p class="hint" style="font-size:15px">${tot(e)} etiquetas coladas em ${conf(e).pecas} peças.${e.motivo?` Diferença registrada: “${esc(e.motivo)}”.`:""}</p>
      <div class="acts"><button class="btn btn-dark" data-act="concluir" style="height:52px">Concluir envio</button></div></div>`:""}
    ${DB.lbl&&its.find(i=>i.cod===DB.lbl)?xLabel(e,its.find(i=>i.cod===DB.lbl)):""}
    <div class="panel"><div class="phd"><h3>${todos?"Produtos do envio":"Seus produtos e itens livres"}</h3>${ROLE()==="gestor"?`<label class="muted vtodos"><input type="checkbox" id="verTodos" ${todos?"checked":""}> Ver itens de todos</label>`:""}</div>
      <div class="irow ihead" aria-hidden="true"><span>Produto</span><span class="c">Kits</span><span class="c">Unitário</span><span class="r">Situação</span></div>
      ${(vis.length?"":`<div class="t2" style="padding:12px 0">Nenhum item livre ou com você.</div>`)}${vis.map(it=>{ const k=kitsDe(it), un=unDe(it); return `<div class="irow ${DB.lbl===it.cod?"sel":""}">
        <div><div class="t1">${esc(nomeCod(it.cod))}</div><div class="t2">${locOf(it.cod)?`<span class="locpill">${locOf(it.cod)}</span> `:`<span class="locpill off">Sem cadastro de local</span> `}cód. ${it.cod} · <b>${it.pecas} peças</b>${eanOf(it.cod)?"":` <span class="locpill warnp">Sem EAN no Picking</span>`}</div></div>
        <div class="icol" aria-label="Kits">${k.n?`<b class="num">${k.n} kit${k.n>1?"s":""}</b><span class="t2">${k.det}</span>`:`<span class="t2">—</span>`}</div>
        <div class="icol" aria-label="Unitário">${un?`<b class="num">${un} un</b>`:`<span class="t2">—</span>`}</div>
        <div class="iend"><div class="ist">${stTag(it)}${it.s.status==="livre"?`<span class="t2">aguardando coleta</span>`:it.s.status==="separando"?`<span class="t2 num">${it.s.n}/${it.pecas} coletadas</span>`:it.s.resp&&it.s.status!=="livre"?`<span class="t2">coletado por ${esc(nomeU(it.s.resp))}</span>`:""}</div>
        <div class="iact">${it.s.status==="coletado"?`<button class="btn btn-dark btn-sm" data-act="lbl" data-cod="${it.cod}">Gerar etiquetas</button>`
          :it.s.status==="impresso"?`<button class="btn btn-sm" data-act="lbl" data-cod="${it.cod}">Continuar · ${it.lab}/${it.etq}</button>`
          :it.s.status==="etiquetado"?`<span class="okmark">✓ ${it.etq} etiquetas</span>`:""}${it.s.status!=="livre"&&e.status==="liberado"?voltaBtn(it):""}</div></div>
      </div>`; }).join("")}
    </div>
    <div class="panel"><h3>Atividade</h3><div class="log">${e.log.slice(-12).reverse().map(l=>`<div><span class="tm">${l.t}</span><span>${esc(l.msg)}</span></div>`).join("")||`<span class="muted">Nada ainda.</span>`}</div></div>
  </div>
  <div class="col side">
    <div class="panel qrbox"><h3>Separar pelo celular</h3>
      <label class="hint" for="qrsel" style="align-self:stretch;text-align:left">QR de quem vai separar</label>
      <select class="inp" id="qrsel" style="align-self:stretch">${sepUsers().map(x=>`<option value="${esc(x)}" ${qrU()===x?"selected":""}>${esc(nomeU(x))}</option>`).join("")}</select>
      <div id="qr" class="qr" aria-label="QR Code para ${esc(nomeU(qrU()))} abrir este envio no celular"><span class="muted">Gerando…</span></div>
      <p class="hint">${esc(nomeU(qrU()))} aponta a câmera e cai direto na lista de produtos, sem login. O link vale só para este envio e expira quando ele for concluído.</p>
      <div class="acts" style="justify-content:center"><button class="btn btn-sm" data-act="qrCopiar">Copiar link</button><button class="btn btn-sm" data-act="qrNovo">Gerar novo QR</button></div>
    </div>
  </div></div>`;
}
function barras(code){ return `<svg class="bc" data-c="${esc(code)}" aria-label="Código de barras ${esc(code)}"></svg>`; }
function drawBarcodes(){ if(!window.JsBarcode) return; document.querySelectorAll("svg.bc:not([data-ok])").forEach(el=>{ try{ JsBarcode(el,el.dataset.c,{format:"CODE128",displayValue:false,height:40,margin:0,width:1.6}); el.setAttribute("data-ok","1"); }catch(x){} }); }
function zplFor(it){
  const etq=it.anuncios.flatMap(a=>Array.from({length:a.etiquetas},()=>a)); const out=[];
  const one=(a,x)=>`^CI28\n^LH0,0\n^FO${x+30},15^BY2,,0^BCN,54,N,N^FD${a.inv}^FS\n^FO${x+105},75^A0N,20,25^FD${a.inv}^FS\n^FO${x+16},115^A0N,18,18^FB300,2,2,L^FD${a.titulo}^FS\n^FO${x+16},172^A0N,18,18^FD${a.ref||""}^FS\n`;
  for(let i=0;i<etq.length;i+=2) out.push("^XA"+one(etq[i],0)+(etq[i+1]?one(etq[i+1],320):"")+"^XZ");
  return out.join("\n");
}
const REFRESH=`<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
function voltaBtn(it){ const pend=DB.voltaPend&&DB.voltaPend.cod===it.cod&&Date.now()-DB.voltaPend.t<6000;
  return `<button class="xvolta ${pend?"on":""}" data-act="volta" data-cod="${it.cod}" title="${pend?"Clique de novo para confirmar":"Recolocar na lista de separação"}" aria-label="Recolocar ${esc(nomeCod(it.cod))} na lista de separação">${REFRESH}${pend?"<span>Recolocar?</span>":""}</button>`; }
function kitsDe(it){ const ks=it.anuncios.filter(a=>a.mult>1); return {n:ks.reduce((t,a)=>t+a.etiquetas,0),det:ks.map(a=>`${a.etiquetas} de ${a.mult} un`).join(" · ")}; }
function unDe(it){ return it.anuncios.filter(a=>a.mult===1).reduce((t,a)=>t+a.etiquetas,0); }
function xLabel(e,it){
  const s=it.s; const imp=s.status==="impresso"; const n=it.anuncios.length;
  const row=a=>{ const d=Math.min(s.lab?.[a.inv]||0,a.etiquetas);
    return `<div class="pl"><b class="num">${a.etiquetas}×</b><div><div class="t1">${a.mult===1?"Etiqueta de unidade":`Etiqueta de kit · junte ${a.mult} peças por saquinho`}</div><div class="t2 mono">${esc(a.inv)}</div></div>
      <div class="plr">${imp?`<span class="num ${d>=a.etiquetas?"okmark":"t2"}">${d}/${a.etiquetas} coladas</span>`:""}${(()=>{ const ja=!!(DB.jaImp||{})[e.id+"|"+a.inv]; return `<button class="btn btn-sm ${ja?"":"btn-dark"}" data-act="imprimir" data-cod="${it.cod}" data-inv="${esc(a.inv)}">${ja?"Reimprimir":"Imprimir"}`; })()} ${a.etiquetas} ${a.mult===1?(a.etiquetas>1?"unidades":"unidade"):(a.etiquetas>1?"kits":"kit")}</button></div></div>`; };
  return `<div class="panel lblp"><div class="lhd"><div><span class="eyebrow">Etiquetas</span><h3 style="font-size:19px">${esc(nomeCod(it.cod))}</h3></div><div class="lhdb"><button class="hbtn" data-act="ajuda" title="Como configurar a impressora térmica" aria-label="Ajuda: como configurar a impressora térmica">?</button><button class="btn btn-sm" data-act="lblx">Fechar</button></div></div>
    <div class="plan">${it.anuncios.map(row).join("")}</div>
    ${imp?`<form class="scan" id="lblForm" autocomplete="off"><input class="inp" id="lscan" placeholder="Bipe cada etiqueta depois de colar" aria-label="Código da etiqueta"><button class="btn btn-dark" type="submit">OK</button></form>
      ${DB.lmsg?`<div class="lmsg ${DB.lmsg.ok?"ok":"err"}">${esc(DB.lmsg.t)}</div>`:""}`:""}
    <div class="acts">${n>1?`<button class="btn ${imp?"":"btn-dark"}" data-act="imprimir" data-cod="${it.cod}">Imprimir todas juntas · ${it.etq} etiquetas</button>`:""}<button class="btn" data-act="zpl" data-cod="${it.cod}">Copiar ZPL</button>${imp?"":`<button class="lnkbtn" data-act="jaimp" data-cod="${it.cod}">Já imprimi, ir para o bipe</button>`}</div>
    <p class="hint">PDF no layout da térmica: 80 × 25 mm, duas etiquetas por linha.</p>
  </div>`;
}
const AJUDA=[
  ["Troque o rolo","Substitua o rolo de etiqueta normal pelo rolo de etiquetas de <b>duas colunas do Full</b> (como o da foto).","rolo"],
  ["Abra as impressoras","No menu Iniciar, digite <b>impressora</b> e clique em <b>Impressoras e scanners</b>. Selecione a <b>MDK-006</b> e clique em <b>Gerenciar</b>.","impressoras"],
  ["Preferências de impressão","Na tela da MDK-006, clique em <b>Preferências de impressão</b> e depois no botão <b>Gestão do papel</b>.","gerenciar"],
  ["Crie o papel Full","Em <b>Nome</b>, digite <b>Full</b>. Em <b>Largura</b>, coloque <b>3.85</b> e em <b>Comprimento</b>, <b>0.98</b> (polegadas). Clique em <b>preservação</b> para salvar e depois em OK.","papel"],
  ["Selecione o papel Full","De volta às preferências, escolha o papel <b>Full</b> na lista e clique em <b>Aplicar</b> e <b>OK</b> para salvar os ajustes.","preferencias"],
  ["Imprima","Gere o PDF das etiquetas pelo app. Na janela de impressão, escolha a <b>MDK-006</b>, abra <b>Mais definições</b> e em <b>Tamanho do papel</b> selecione <b>Full</b>. Clique em <b>Imprimir</b>.","imprimir"]];
function ajudaCorpo(){ const n=AJUDA.length, i=Math.max(0,Math.min(n-1,DB.ajI||0)); const [t,d,img]=AJUDA[i];
  return `<div class="mdlh"><div><span class="eyebrow">Ajuda · etapa ${i+1} de ${n}</span><h3 id="ajT">Configurar a impressora térmica para o Full</h3></div><button class="hbtn" data-act="ajudax" aria-label="Fechar ajuda">×</button></div>
  <ol class="ajstep" aria-label="Etapas">${AJUDA.map(([tt],k)=>`<li class="${k<i?"ok":k===i?"cur":""}"><button data-act="aj-ir" data-i="${k}" aria-label="Etapa ${k+1}: ${esc(tt)}${k<i?" (concluída)":""}" ${k===i?'aria-current="step"':""}><span class="ajdot">${k<i?"✓":k+1}</span><span class="ajlb">${esc(tt)}</span></button></li>`).join("")}</ol>
  <div class="ajslide"><b class="ajtt">${i+1}. ${t}</b><p>${d}</p>${img?`<img src="/ajuda/${img}.jpg" alt="${esc(t)}">`:""}</div>
  <div class="ajnav"><button class="btn" data-act="aj-ir" data-i="${i-1}" ${i===0?"disabled":""}>‹ Anterior</button>
    ${i<n-1?`<button class="btn btn-dark" data-act="aj-ir" data-i="${i+1}">Feito, próxima etapa ›</button>`:`<button class="btn btn-dark" data-act="ajudax">✓ Concluir configuração</button>`}</div>`; }
function ajudaHtml(){ return `<div class="mdl" data-act="ajudax"><div class="mdlc" role="dialog" aria-modal="true" aria-labelledby="ajT" data-stop="1">${ajudaCorpo()}</div></div>`; }
function ajudaUpd(){ const c=document.querySelector(".mdlc"); if(c){ c.innerHTML=ajudaCorpo(); const f=c.querySelector(".ajnav .btn-dark")||c.querySelector(".hbtn"); if(f) f.focus(); } }
const qrU=()=>DB.qrU&&DB.users[DB.qrU]?DB.qrU:DB.me;
async function qrLink(envio,login,novo){ const k=envio+"|"+login; if(novo||!DB.qrTok[k]){ const r=await api("qr",{envio,login,novo:!!novo}); DB.qrTok[k]=r.token; } return `${APP_URL}#s-${DB.qrTok[k]}`; }
async function drawQR(e){
  const el=$("#qr"); if(!el) return; let url;
  try{ url=await qrLink(e.id,qrU()); }catch(x){ el.innerHTML=`<span class="hint">${esc(x.message)}</span>`; return; }
  const el2=$("#qr"); if(!el2) return;
  try{ const q=qrcode(0,"M"); q.addData(url); q.make(); el2.innerHTML=q.createSvgTag({cellSize:4,margin:2,scalable:true}); }
  catch(x){ el2.innerHTML=`<span class="hint">${esc(url)}</span>`; }
}

/* --- celular --- */
const ENGR=`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" d="M10.3 3h3.4l.5 2.4 1.9.8 2-1.4 2.4 2.4-1.4 2 .8 1.9 2.4.5v3.4l-2.4.5-.8 1.9 1.4 2-2.4 2.4-2-1.4-1.9.8-.5 2.4h-3.4l-.5-2.4-1.9-.8-2 1.4-2.4-2.4 1.4-2-.8-1.9L3 13.7v-3.4l2.4-.5.8-1.9-1.4-2 2.4-2.4 2 1.4 1.9-.8z"/><circle cx="12" cy="12" r="3.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`;
function phoneHtml(e,u,mode){
  const its=itens(e); const ph=mode==="sim"?(DB.ph[u]||(DB.ph[u]={scr:"lista"})):(DB.ph["_m"]||(DB.ph["_m"]={scr:"lista"}));
  const md=modoDe(u);
  const top=`<div class="ptop"><img src="${LOGO.escuro}" alt="Serena"><div><b>Envio #${e.id}</b><small>${esc(nomeU(u))} · ${modoTxt(md)}</small></div><button class="pcfg" data-act="p-cfg" data-u="${u}" aria-label="Configurar bipagem" aria-expanded="${!!ph.cfg}" title="Configurar bipagem">${ENGR}</button></div>
  ${ph.cfg?`<div class="pcfgbox"><b>Como você vai bipar?</b><span class="t2">Fica salvo para ${esc(nomeU(u))} em qualquer celular.</span>
    ${MODOS.map(([k,t])=>`<button class="pmodo ${md===k?"on":""}" data-act="p-modo" data-u="${u}" data-m="${k}" aria-pressed="${md===k}"><b>${t}</b><span>${{camera:"A câmera abre sozinha ao pegar um item. Aponte para o código de barras.",bluetooth:"Leitor pareado ao celular. O campo fica pronto para o bipe e o teclado não abre.",coletor:"Coletor com leitor embutido. O campo fica sempre pronto e o bipe entra mesmo sem Enter."}[k]}</span></button>`).join("")}</div>`:""}`;
  const it=ph.scr==="pick"&&its.find(i=>i.cod===ph.cod&&i.s.status==="separando"&&i.s.resp===u);
  if(it){
    const p=prod(it.cod)||{nome:nomeCod(it.cod),ean:""}; const full=it.s.n>=it.pecas;
    return `${top}<div class="pbody">
      <button class="pback" data-act="p-back" data-u="${u}">← Lista</button>
      ${locOf(it.cod)?`<div class="pcard2 ploc"><span class="eyebrow">Endereço no estoque</span><div class="loc-code">${locOf(it.cod)}</div><span class="t2">${locTxt(locOf(it.cod))}</span>
        <div class="map-card" id="map-${mode}-${u}" data-k="${u}:${it.cod}">${mapSVG({loc:parseCode(locOf(it.cod))},null)}</div></div>`
        :`<div class="pcard2 ploc"><div class="noloc">Sem cadastro de local</div></div>`}
      <div class="pcard2"><span class="eyebrow">Cód. ${it.cod}${eanOf(it.cod)?` · EAN ${eanOf(it.cod)}`:""}</span><h2>${esc(p.nome)}</h2>${eanOf(it.cod)?"":`<div class="lmsg err">EAN não cadastrado no Picking. Avise o gestor ou use "Contar sem bipe".</div>`}
        <div class="pcount"><b class="num">${it.s.n}</b><span class="num">de ${it.pecas} peças</span></div>
        <div class="bar"><i class="${full?"full":""}" style="width:${Math.round(it.s.n/it.pecas*100)}%"></i></div>
        <span class="t2">${compo(it)}. A montagem dos kits é feita na bancada.</span></div>
      ${ph.msg?`<div class="lmsg ${ph.msg.ok?"ok":"err"}">${esc(ph.msg.t)}</div>`:""}
      ${full?`<button class="btn btn-dark pbig" data-act="p-done" data-u="${u}" data-cod="${it.cod}">Coletei tudo · liberar etiquetas</button>`
      :`${md==="camera"?(('BarcodeDetector' in window)?`<div id="camwrap" hidden><video id="cam" playsinline muted></video><button class="btn btn-sm" data-act="p-camx">Fechar câmera</button></div><button class="btn btn-dark pbig" id="camopen" data-act="p-cam" data-u="${u}">Abrir câmera para bipar</button>`
          :`<div class="lmsg err">Este navegador não lê código pela câmera. Use o Chrome no Android ou troque o modo de bipagem na engrenagem.</div>`):""}
        <form class="pscan" data-u="${u}" data-modo="${md}" autocomplete="off"><input class="inp" id="pscan-${u}" placeholder="${md==="camera"?"Ou digite o código":"Bipe a peça"}" inputmode="${md==="camera"||DB.digitar?"numeric":"none"}" aria-label="Código da peça"><button class="btn btn-dark" type="submit">OK</button></form>
        ${md!=="camera"?`<div class="pmodohint"><span class="t2">${ph.lido?`Último código lido: <span class="mono">${esc(ph.lido)}</span>`:md==="bluetooth"?"Leitor Bluetooth: pode bipar direto.":"Coletor: pode bipar direto."}</span><button class="lnkbtn" data-act="p-digitar">${DB.digitar?"Esconder teclado":"Digitar código"}</button></div>`:""}
        <div class="acts"><button class="btn" style="flex:1" data-act="p-mais" data-u="${u}">Contar sem bipe (+1)</button><button class="btn" style="flex:1" data-act="p-tudo" data-u="${u}" data-cod="${it.cod}">Contei tudo (${it.pecas})</button></div>`}
      <button class="lnkbtn" data-act="p-solta" data-u="${u}" data-cod="${it.cod}">Devolver este item para a lista</button>
    </div>`;
  }
  const meus=its.filter(i=>i.s.status==="separando"&&i.s.resp===u), livres=its.filter(i=>i.s.status==="livre"),
        outros=its.filter(i=>i.s.status==="separando"&&i.s.resp!==u), feitos=its.filter(i=>["coletado","impresso","etiquetado"].includes(i.s.status)&&i.s.resp===u);
  livres.sort((a,b)=>locOrd(a.cod).localeCompare(locOrd(b.cod)));
  const card=(i,act)=>`<div class="pitem2"><div>${locOf(i.cod)?`<span class="locpill">${locOf(i.cod)}</span>`:`<span class="locpill off">Sem cadastro de local</span>`}<div class="t1">${esc(nomeCod(i.cod))}</div><div class="t2">cód. ${i.cod} · <b>${i.pecas} peças</b></div></div>${act}</div>`;
  return `${top}<div class="pbody">
    ${meus.length?`<span class="psec">Com você</span>${meus.map(i=>card(i,`<button class="btn btn-dark btn-sm" data-act="p-open" data-u="${u}" data-cod="${i.cod}">Continuar ${i.s.n}/${i.pecas}</button>`)).join("")}`:""}
    <span class="psec">Para buscar · na ordem do caminho</span>
    ${livres.length?livres.map(i=>card(i,`<button class="btn btn-dark btn-sm" data-act="p-pega" data-u="${u}" data-cod="${i.cod}">Vou separar</button>`)).join(""):`<span class="t2">Nada livre para buscar.</span>`}
    ${feitos.length?`<span class="psec">Já coletados por você</span>${feitos.map(i=>card(i,stTag(i))).join("")}`:""}
  </div>`;
}
function renderPhoneFull(){
  const e=env(DB.mobile);
  if(!e||e.status!=="liberado"||!DB.mobileU){ $("#app").innerHTML=`<div class="phonefull"><div class="ptop"><img src="${LOGO.escuro}" alt="Serena"><div><b>Separação Full</b></div></div><div class="pbody"><h2>${e&&e.status==="concluido"?"Este envio já foi concluído":"Link inválido ou expirado"}</h2><p class="hint">Peça um QR novo no computador da expedição.</p></div></div>`; return; }
  setTimeout(runMaps,0);
  $("#app").innerHTML=`<div class="phonefull">${phoneHtml(e,DB.mobileU,"full")}</div>`;
  if(FOCUS){ const f=document.getElementById(FOCUS); if(f) f.focus(); }
}
let FILA=Promise.resolve();
let PEND=0;
function enfileira(fn){ PEND++; FILA=FILA.then(fn).catch(()=>{}).finally(()=>{ PEND--; }); return FILA; }
/* ação do celular com resposta imediata: aplica na tela já e confirma no servidor em segundo plano */
function otim(e,cod,acaoNome,extra,msg,aplica){
  const s=sepOf(e,cod); const antes=JSON.parse(JSON.stringify(s)); aplica(s);
  enfileira(async()=>{ try{ const r=await api("sep",{envio:e.id,cod,acao:acaoNome,msg,...extra}); if(r.erro) throw new Error(r.erro);
      if(r.sep) Object.assign(s,{status:r.sep.status,resp:r.sep.resp,n:r.sep.n,lab:r.sep.lab||{}}); }
    catch(x){ Object.assign(s,antes); toast(x.message); beep(false); try{ await carregar(true); }catch(_){} render(); } });
}
/* compara o bipe com o EAN aceitando o que leitores/coletores costumam acrescentar:
   prefixo de símbolo (ex.: ]E0), Tab/Enter, espaços, zero à esquerda (UPC-A × EAN-13) */
function eanBate(code,ean){ const c=String(code||"").replace(/\D/g,""), e=String(ean||"").replace(/\D/g,""); if(!c||!e) return false;
  return c===e || c.replace(/^0+/,"")===e.replace(/^0+/,"") || (c.length>e.length&&c.endsWith(e)) || (c.length>e.length&&c.startsWith(e)&&c.length-e.length<=2); }
function phScan(e,u,code){
  const key=DB.mobile?"_m":u; const ph=DB.ph[key]; const it=itens(e).find(i=>i.cod===ph.cod); const s=sepOf(e,ph.cod);
  if(!it||s.resp!==u) return;
  if(code!==null && !eanOf(it.cod)){ ph.msg={ok:false,t:"EAN não cadastrado no Picking"}; beep(false); return; }
  if(code!==null){ ph.lido=String(code).replace(/[\x00-\x1f]/g,"⏎").slice(0,40); }
  if(code!==null && !eanBate(code,eanOf(it.cod))){ ph.msg={ok:false,t:"Produto incorreto"}; beep(false); return; }
  if(s.n>=it.pecas){ ph.msg={ok:false,t:"Peças completas"}; beep(false); return; }
  s.n++; ph.msg={ok:true,t:s.n>=it.pecas?"Separação concluída":`Produto conferido · ${s.n}/${it.pecas}`}; beep(true);
  enfileira(async()=>{ try{ const r=await api("sep",{envio:e.id,cod:it.cod,acao:"n",total:it.pecas}); if(r.sep) s.n=r.sep.n; }catch(x){ ph.msg={ok:false,t:x.message}; beep(false); try{ await carregar(true); }catch(_){} render(); } });
}
function lblScan(e,code){
  const cod=DB.lbl; const it=itens(e).find(i=>i.cod===cod); const s=sepOf(e,cod); const c=code.trim().toUpperCase();
  const a=it.anuncios.find(x=>x.inv===c);
  if(!a){ DB.lmsg={ok:false,t:"Etiqueta incorreta"}; beep(false); return; }
  s.lab=s.lab||{}; if((s.lab[c]||0)>=a.etiquetas){ DB.lmsg={ok:false,t:"Etiqueta sobrando"}; beep(false); return; }
  s.lab[c]=(s.lab[c]||0)+1; beep(true);
  DB.lmsg={ok:true,t:`${a.mult===1?"Unidade":"Kit"} conferido · ${s.lab[c]}/${a.etiquetas}`};
  const final=it.anuncios.every(x=>(s.lab[x.inv]||0)>=x.etiquetas);
  if(final){ s.status="etiquetado"; DB.lbl=null; DB.lmsg=null; toast("Produto etiquetado"); }
  enfileira(async()=>{ try{ await api("sep",{envio:e.id,cod,acao:"lab",inv:c,max:a.etiquetas,final,msg:final?`etiquetou ${nomeCod(cod)} (${it.etq} etiquetas)`:""}); }catch(x){ toast(x.message); beep(false); try{ await carregar(true); }catch(_){} render(); } });
}
