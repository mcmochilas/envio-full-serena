/* ---------- roteamento / login ---------- */
/* celular: #s-<token> (gerado no servidor, vale só para um envio e uma pessoa); sem login */
function rota(){ const m=location.hash.match(/^#s-([\w-]+)/); DB.qr=m?m[1]:null; if(!m){ DB.mobile=null; DB.mobileU=null; } }
rota();
function render(){ render0(); try{ posRender(); }catch(x){} if(FOCUS==="anEdIn"){ const f=document.getElementById("anEdIn"); if(f){ f.focus(); f.select(); } } const m=document.querySelector(".mdl");
  if(DB.ajuda&&!DB.qr){ if(!m){ document.body.insertAdjacentHTML("beforeend",ajudaHtml()); document.body.style.overflow="hidden"; const x=document.querySelector(".mdl .hbtn"); if(x) x.focus(); } }
  else if(m){ m.remove(); document.body.style.overflow=""; const h=document.querySelector('[data-act="ajuda"]'); if(h) h.focus(); } }
document.addEventListener("keydown",ev=>{ if(ev.key==="Escape"&&DB.edAn&&ev.target.id==="anEdIn"){ DB.edAn=null; render(); return; } if(!DB.ajuda) return; if(ev.key==="Escape"){ DB.ajuda=false; render(); }
  else if(ev.key==="ArrowRight"||ev.key==="ArrowLeft"){ DB.ajI=Math.max(0,Math.min(AJUDA.length-1,(DB.ajI||0)+(ev.key==="ArrowRight"?1:-1))); ajudaUpd(); } });
function render0(){
  if(DB.qr){ if(!DB.carregado) return renderCarregando(); return renderPhoneFull(); }
  if(!PREF.token||!DB.me) return renderLogin();
  if(!DB.carregado) return renderCarregando();
  if(ROLE()==="gestor" && !DB.asExp) return renderGestor();
  return renderExp();
}
function renderCarregando(msg){ $("#app").innerHTML=`<div class="lg"><div class="lg-card" style="align-items:center"><img class="lg-brand" src="${LOGO.claro}" alt="Serena Puxadores"><span class="lg-sub">Envios Full</span><p class="hint">${esc(msg||"Carregando…")}</p></div></div>`; }
function renderLogin(err){
  $("#app").innerHTML=`<div class="lg"><form class="lg-card" id="lgForm">
    <img class="lg-brand" src="${LOGO.claro}" alt="Serena Puxadores">
    <span class="lg-sub">Envios Full</span>
    ${err?`<div class="err" role="alert">${esc(err)}</div>`:""}
    <div class="fld"><label for="lgU">Usuário</label><input class="inp" id="lgU" autocomplete="username" autocapitalize="none" required></div>
    <div class="fld"><label for="lgP">PIN</label><input class="inp" id="lgP" type="password" inputmode="numeric" maxlength="4" autocomplete="current-password" required></div>
    <button class="btn btn-dark" type="submit" style="height:50px">Entrar</button>
  </form></div>`;
  $("#lgForm").onsubmit=async e=>{ e.preventDefault(); const bt=e.target.querySelector("button"); bt.disabled=true; bt.textContent="Entrando…";
    tocaSomSerena();
    try{ const r=await api("login",{login:$("#lgU").value.trim().toLowerCase(),pin:$("#lgP").value}); PREF.token=r.token; DB.me=r.me.login; DB.meObj=r.me; DB.asExp=false; DB.cur=null; save();
      await carregar(true); render(); mlPendente(); }
    catch(x){ renderLogin(x.message); } };
}
async function iniciar(){
  if(DB.qr){ renderCarregando("Abrindo o envio…");
    try{ await carregar(true); DB.mobile=DB.meObj.qrEnvio; DB.mobileU=DB.meObj.login; }catch(x){ DB.carregado=true; DB.mobile="__x"; DB.mobileU=null; }
    render(); return; }
  if(PREF.token){ renderCarregando(); try{ await carregar(true); }catch(x){ PREF.token=null; save(); } }
  render(); mlPendente();
}

/* ---------- atualização automática (outras pessoas no mesmo envio) ---------- */
function digitando(){ const a=document.activeElement; return a && (a.id==="fq"||a.id==="mlQ"||a.dataset?.vq!==undefined||a.tagName==="TEXTAREA"||(a.closest&&a.closest("#uForm"))||a.type==="date"||a.type==="number"); }
setInterval(async()=>{
  if(document.hidden||ocupado||PEND>0||!DB.carregado||(!PREF.token&&!DB.qr)||DB.mobile==="__x") return;
  try{ const mudou=await carregar(false); if(mudou&&!digitando()){ const a=document.activeElement, id=a?.id, val=a?.value; render(); if(id){ const n=document.getElementById(id); if(n){ n.focus(); if(val&&n.value!==undefined&&!n.value) n.value=val; } } } }catch(e){}
},4000);

/* ---------- câmera do celular (BarcodeDetector) ---------- */
let CAM=null;
async function camLiga(e,u){
  const w=$("#camwrap"), v=$("#cam"); if(!w||!v) return;
  try{ const det=new BarcodeDetector({formats:["ean_13","ean_8","code_128","upc_a"]}); const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    v.srcObject=st; await v.play(); w.hidden=false; CAM={st,ultimo:"",t:0}; const o=$("#camopen"); if(o) o.hidden=true;
    const loop=async()=>{ if(!CAM) return; try{ const r=await det.detect(v); if(r[0]){ const c=r[0].rawValue, agora=Date.now(); if(c!==CAM.ultimo||agora-CAM.t>1200){ CAM.ultimo=c; CAM.t=agora; phScan(e,u,c); atualizaPick(); } } }catch(x){} if(CAM) setTimeout(loop,250); };
    loop(); }
  catch(x){ toast("Câmera indisponível"); }
}
/* modo de bipagem: câmera abre sozinha; leitor/coletor deixam o campo sempre pronto */
let AUTOCAM=null;
function prepBipe(u){ if(modoDe(u)==="camera"){ FOCUS=null; AUTOCAM=u; } else { FOCUS=`pscan-${u}`; AUTOCAM=null; } }
function posRender(){ const e=DB.mobile?env(DB.mobile):DB.cur&&env(DB.cur);
  if(CAM){ const o=$("#camopen"); if(o) o.hidden=true; }
  if(AUTOCAM&&e){ const u=AUTOCAM; AUTOCAM=null; if($("#camwrap")&&!CAM) camLiga(e,u); } }
document.addEventListener("focusout",ev=>{ const t=ev.target; const f=t.closest&&t.closest("form.pscan"); if(!f||f.dataset.modo==="camera"||DB.digitar) return;
  setTimeout(()=>{ const a=document.activeElement; if(a&&a!==document.body&&a.tagName!=="HTML") return; const n=document.getElementById(t.id); if(n) n.focus({preventScroll:true}); },180); });
let COL_T=null;
document.addEventListener("input",ev=>{ const t=ev.target; const f=t.closest&&t.closest("form.pscan"); if(!f||f.dataset.modo!=="coletor") return;
  /* coletor: envia assim que o código bate com o EAN esperado (ou tem o tamanho dele); sem isso, só depois de uma pausa longa.
     Coletores digitam em rajadas, então nunca envia pela metade. Se o coletor mandar Enter, o envio é imediato. */
  clearTimeout(COL_T); const v=t.value.trim(); const ph=DB.ph[DB.mobile?"_m":f.dataset.u]; const esp=ph&&ph.cod?eanOf(ph.cod):"";
  if(esp&&(v===esp||v.length>=esp.length)){ f.requestSubmit(); return; }
  COL_T=setTimeout(()=>{ const w=t.value.trim(); if(w.length>=(esp?esp.length:8)&&document.body.contains(f)) f.requestSubmit(); },900); });
function camDesliga(){ if(CAM){ CAM.st.getTracks().forEach(t=>t.stop()); CAM=null; } }
function atualizaPick(){ const cam=CAM; if(cam){ const v=$("#cam"); const w=$("#camwrap"); render(); const v2=$("#cam"), w2=$("#camwrap"); if(v2&&w2){ v2.srcObject=cam.st; v2.play(); w2.hidden=false; } else camDesliga(); } else render(); }

/* ---------- eventos ---------- */
document.addEventListener("click",ev=>{
  const pk0=ev.target.closest("[data-pick]");
  if(pk0){ const inv=pk0.dataset.inv; acao(()=>api("vinc",{inv,cod:pk0.dataset.pick,mult:V(inv).mult}),"Vínculo salvo."); return; }
  if(!ev.target.closest(".combo")) document.querySelectorAll(".clist").forEach(c=>c.hidden=true);
  const b=ev.target.closest("[data-act]"); if(!b) return; const act=b.dataset.act;
  if(act!=="delenv") DB.delPend=null;
  if(act!=="volta") DB.voltaPend=null;
  const e=DB.mobile?env(DB.mobile):DB.cur&&env(DB.cur); const u=b.dataset.u; const pk=DB.mobile?"_m":u;
  FOCUS=null;
  const sep=(acaoNome,cod,extra={},msg="")=>api("sep",{envio:e.id,cod,acao:acaoNome,msg,...extra});
  switch(act){
    case "logout": camDesliga(); api("logout").catch(()=>{}); PREF.token=null; DB.me=null; DB.meObj=null; DB.carregado=false; DB.cur=null; DB.lbl=null; break;
    case "tab": DB.tab=b.dataset.t; DB.uEdit=null; if(DB.tab==="estoque"&&DB.ml) mlCarregar(); break;
    case "ml-conectar": mlConectar(); return;
    case "ml-recarregar": DB.mlErro=null; DB.ml=null; break;
    case "ml-sync": DB.mlSync=true; render(); api("ml_sync",{}).then(r=>toast(`Sincronizado · ${r.anuncios} anúncios`)).catch(x=>toast(x.message)).finally(async()=>{ DB.mlSync=false; await mlCarregar(); }); return;
    case "ml-dias": if(b.dataset.d==="custom"){ DB.mlCustom=true; break; } DB.mlCustom=false; DB.mlDias=+b.dataset.d; DB.pg.mla=1; mlCarregar(); break;
    case "ml-visao": DB.mlModelo=b.dataset.v==="mod"; break;
    case "ml-hist": { const inv=b.dataset.inv; if(DB.mlInv===inv){ DB.mlInv=null; break; } DB.mlInv=inv; DB.mlHist=null;
      api("ml_hist",{inv}).then(r=>{ DB.mlHist={inv,ops:r.ops||[]}; render(); }).catch(x=>toast(x.message)); break; }
    case "vpg": DB.vpg=+b.dataset.p; break;
    case "pg": DB.pg[b.dataset.k]=+b.dataset.p; if(b.dataset.k.startsWith("an-")) DB.openAn=b.dataset.k.slice(3); break;
    case "per": DB.f.per=b.dataset.p; DB.pg.envios=1; break;
    case "sel": DB.sel=b.dataset.id||null; break;
    case "novo": DB.sel="novo"; DB.imp=null; break;
    case "criar": { const I=DB.imp; if(!I||!I.anuncios.length){ toast("Falta o arquivo de etiquetas"); return; } if(!I.pvs.length){ toast("Falta a pré-venda"); return; }
      b.disabled=true; b.textContent="Importando…";
      acao(async()=>{ await api("importar",{envio:{id:I.id,anuncios:I.anuncios,pre:I.pre,pvs:I.pvs},erp:I.erpNovos,vinc:I.vinc}); DB.f={per:"todos",q:""}; DB.sel=I.id; DB.imp=null; },"Envio importado"); return; }
    case "delenv": { const id=b.dataset.id, e0=env(id);
      if(!(DB.delPend&&DB.delPend.id===id&&Date.now()-DB.delPend.t<6000)){ DB.delPend={id,t:Date.now()}; toast("Clique no X de novo para excluir"); break; }
      DB.delPend=null; acao(async()=>{ await api("excluir",{id}); if(DB.sel===id) DB.sel=null; },"Envio excluído"); return; }
    case "excluir": if(b.dataset.ok!=="1"){ b.dataset.ok="1"; b.textContent="Clique de novo para confirmar a exclusão"; return; } acao(async()=>{ await api("excluir",{id:b.dataset.id}); DB.sel=null; },"Rascunho excluído."); return;
    case "zpl": { const it=itens(e).find(i=>i.cod===b.dataset.cod); navigator.clipboard.writeText(zplFor(it)).then(()=>toast("ZPL copiado"),()=>toast("Não deu para copiar.")); return; }
    case "liberar": acao(()=>api("liberar",{id:b.dataset.id}),"Envio liberado"); return;
    case "addpre": { const x=env(b.dataset.id); const r=conf(x).rows.find(r=>r.cod===b.dataset.cod); if(!r||r.d>=0) return;
      acao(()=>api("addpre",{id:x.id,cod:r.cod,qtd:-r.d}),"Pré-venda ajustada"); return; }
    case "rmpre": acao(()=>api("rmpre",{id:b.dataset.id,cod:b.dataset.cod})); return;
    case "to-exp": DB.asExp=true; DB.cur=null; break;
    case "to-gestor": DB.asExp=false; DB.cur=null; break;
    case "home": DB.cur=null; DB.lbl=null; break;
    case "abrir": DB.cur=b.dataset.id; DB.lbl=null; DB.qrU=DB.me; break;
    case "concluir": acao(async()=>{ await api("concluir",{id:e.id}); DB.cur=null; },"Tarefa finalizada"); return;
    case "qrNovo": acao(async()=>{ await qrLink(e.id,qrU(),true); },"Novo QR gerado"); return;
    case "qrCopiar": qrLink(e.id,qrU()).then(l=>navigator.clipboard.writeText(l)).then(()=>toast("Link copiado."),x=>toast(x?.message||"Não deu para copiar.")); return;
    case "lbl": DB.lbl=b.dataset.cod; DB.lmsg=null; if(sepOf(e,DB.lbl).status==="impresso") FOCUS="lscan"; break;
    case "ajuda": DB.ajuda=true; DB.ajI=0; break;
    case "aj-ir": DB.ajI=Math.max(0,Math.min(AJUDA.length-1,+b.dataset.i)); ajudaUpd(); return;
    case "ajudax": if(ev.target.closest("[data-stop]")&&!ev.target.closest('button[data-act="ajudax"]')) return; DB.ajuda=false; break;
    case "anEd": DB.edAn={id:b.dataset.id,inv:b.dataset.inv}; FOCUS="anEdIn"; break;
    case "anEdX": DB.edAn=null; break;
    case "volta": { const cod=b.dataset.cod, it=itens(e).find(i=>i.cod===cod);
      if(!(DB.voltaPend&&DB.voltaPend.cod===cod&&Date.now()-DB.voltaPend.t<6000)){ DB.voltaPend={cod,t:Date.now()};
        toast("Clique de novo para recolocar"); break; }
      DB.voltaPend=null; if(DB.lbl===cod) DB.lbl=null;
      acao(()=>sep("volta",cod,{},`recolocou ${nomeCod(cod)} na lista de separação`),"Item recolocado na separação"); return; }
    case "lblx": DB.lbl=null; DB.lmsg=null; break;
    case "imprimir": { const cod=b.dataset.cod, inv=b.dataset.inv||null; const it0=itens(e).find(i=>i.cod===cod); const a0=inv&&it0?it0.anuncios.find(x=>x.inv===inv):null;
      const oq=a0?`${a0.etiquetas} etiquetas ${a0.mult===1?"de unidade":"de kit"} de ${nomeCod(cod)}`:`as etiquetas de ${nomeCod(cod)}`;
      imprimirPDF(e,cod,inv).then(ok=>{ if(!ok) return; DB.jaImp=DB.jaImp||{}; (it0?it0.anuncios:[]).filter(x=>!inv||x.inv===inv).forEach(x=>DB.jaImp[e.id+"|"+x.inv]=true); FOCUS="lscan"; if(sepOf(e,cod).status==="coletado") acao(()=>sep("impresso",cod,{},`imprimiu ${oq}`)); else render(); }); return; }
    case "jaimp": { const cod=b.dataset.cod; FOCUS="lscan"; acao(()=>sep("impresso",cod,{},`imprimiu as etiquetas de ${nomeCod(cod)}`)); return; }
    case "uNovo": DB.uEdit={novo:true,role:"expedicao",ativo:true}; break;
    case "uEdit": DB.uEdit={...DB.users[u]}; break;
    case "uCancel": DB.uEdit=null; break;
    /* celular */
    case "p-pega": { const cod=b.dataset.cod; const s0=sepOf(e,cod); if(s0.status!=="livre"){ toast("Item já está com outra pessoa"); break; }
      otim(e,cod,"pega",{},`começou a separar ${nomeCod(cod)}`,s=>Object.assign(s,{status:"separando",resp:u,n:0}));
      DB.ph[pk]={scr:"pick",cod,msg:null}; prepBipe(u); window.scrollTo(0,0); break; }
    case "p-open": DB.ph[pk]={scr:"pick",cod:b.dataset.cod,msg:null}; prepBipe(u); break;
    case "p-cfg": { const ph=DB.ph[pk]||(DB.ph[pk]={scr:"lista"}); ph.cfg=!ph.cfg; break; }
    case "p-modo": { const m=b.dataset.m; if(DB.users[u]) DB.users[u].modo=m; const ph=DB.ph[pk]; if(ph) ph.cfg=false; DB.digitar=false; if(m!=="camera") camDesliga();
      api("modo",{modo:m,login:u}).catch(x=>toast(x.message)); toast("Bipagem atualizada"); prepBipe(u); break; }
    case "p-digitar": DB.digitar=!DB.digitar; FOCUS=`pscan-${u}`; break;
    case "p-back": camDesliga(); DB.ph[pk]={scr:"lista"}; break;
    case "p-mais": phScan(e,u,null); atualizaPick(); return;
    case "p-tudo": { const it=itens(e).find(i=>i.cod===b.dataset.cod); if(b.dataset.ok!=="1"){ b.dataset.ok="1"; b.textContent=`Confirmar: peguei as ${it.pecas} peças`; return; }
      otim(e,it.cod,"tudo",{total:it.pecas},"",s=>{ s.n=it.pecas; }); DB.ph[pk].msg={ok:true,t:"Separação concluída"}; break; }
    case "p-cam": camLiga(e,u); return;
    case "p-camx": camDesliga(); $("#camwrap").hidden=true; return;
    case "p-done": { camDesliga(); const it=itens(e).find(i=>i.cod===b.dataset.cod);
      otim(e,it.cod,"done",{total:it.pecas},`coletou ${nomeCod(it.cod)} (${it.pecas} peças)`,s=>{ s.status="coletado"; });
      DB.ph[pk]={scr:"lista"}; toast("Separação concluída"); window.scrollTo(0,0); break; }
    case "p-solta": { camDesliga(); const cod=b.dataset.cod;
      otim(e,cod,"solta",{},`devolveu ${nomeCod(cod)} para a lista`,s=>Object.assign(s,{status:"livre",resp:null,n:0}));
      DB.ph[pk]={scr:"lista"}; window.scrollTo(0,0); break; }
    default: return;
  }
  save(); render();
});
document.addEventListener("change",ev=>{ const t=ev.target;
  if(t.dataset.vm!==undefined){ const inv=t.dataset.vm; acao(()=>api("vinc",{inv,cod:V(inv).cod,mult:Math.max(1,parseInt(t.value,10)||1)}),"Vínculo salvo."); }
  else if(t.id==="snd"){ DB.mute=!t.checked; save(); }
  else if(t.id==="qrsel"){ DB.qrU=t.value; render(); }
  else if(t.id==="fCusto"){ lerCustos(t); }
  else if(t.id==="mlOrd"){ DB.mlOrd=t.value; render(); }
  else if(t.id==="fEtq"||t.id==="fPdf"){ lerArquivos(t); }
  else if(t.id==="fUpEtq"||t.id==="fUpPdf"){ atualizarEnvio(t); }
  else if(t.id==="fde"||t.id==="fate"){ DB.f[t.id==="fde"?"de":"ate"]=t.value; DB.pg.envios=1; $("#elist").innerHTML=gEnviosList(); }
});
document.addEventListener("submit",ev=>{
  const f=ev.target; const e=DB.mobile?env(DB.mobile):DB.cur&&env(DB.cur);
  if(f.classList.contains("anEd")){ ev.preventDefault(); const inv=f.dataset.inv, mult=parseInt(f.querySelector("input").value,10), v=V(inv);
    if(!(mult>=1)) return toast("Quantidade inválida");
    if(mult===v.mult){ DB.edAn=null; render(); return; }
    acao(async()=>{ await api("vinc",{inv,cod:v.cod,mult}); DB.edAn=null; },"Peças por kit atualizadas"); return; }
  if(f.id==="mlDiasF"){ ev.preventDefault(); const d=Math.min(365,Math.max(1,parseInt($("#mlDias").value,10)||30)); DB.mlDias=d; mlCarregar(); return; }
  if(f.id==="lblForm"){ ev.preventDefault(); lblScan(e,$("#lscan").value); FOCUS=DB.lbl?"lscan":null; render(); }
  else if(f.classList.contains("pscan")){ ev.preventDefault(); const u=f.dataset.u; clearTimeout(COL_T); phScan(e,u,f.querySelector("input").value); FOCUS=f.dataset.modo==="camera"&&!DB.digitar?null:`pscan-${u}`; render(); }
  else if(f.id==="uForm"){ ev.preventDefault(); const d={login:$("#uLogin").value.trim().toLowerCase(),nome:$("#uNome").value.trim(),role:$("#uRole").value,modo:$("#uModo").value,pin:$("#uPin").value.trim(),ativo:$("#uAtivo").checked};
    acao(async()=>{ await api("user",d); DB.uEdit=null; },"Usuário salvo."); }
});
document.addEventListener("focusin",ev=>{ if(ev.target.dataset?.vq!==undefined){ ev.target.select(); comboBusca(ev.target); } });
document.addEventListener("input",ev=>{ if(ev.target.dataset?.vq!==undefined) comboBusca(ev.target);
  if(ev.target.id==="mlQ"){ DB.mlQ=ev.target.value; DB.pg.mla=1; DB.pg.mlm=1; const pos=ev.target.selectionStart; render(); const n=$("#mlQ"); if(n){ n.focus(); n.setSelectionRange(pos,pos); } return; }
  if(ev.target.id==="fq"){ DB.f.q=ev.target.value; DB.pg.envios=1; $("#elist").innerHTML=gEnviosList(); } });
document.addEventListener("keydown",ev=>{ const t=ev.target; if(t.dataset?.vq===undefined) return; const opts=[...t.nextElementSibling.querySelectorAll(".copt")]; let i=opts.findIndex(o=>o.classList.contains("on"));
  if(ev.key==="ArrowDown"||ev.key==="ArrowUp"){ ev.preventDefault(); if(!opts.length) return; opts[i]?.classList.remove("on"); i=(i+(ev.key==="ArrowDown"?1:-1)+opts.length)%opts.length; opts[i].classList.add("on"); opts[i].scrollIntoView({block:"nearest"}); }
  else if(ev.key==="Enter"&&opts[i]){ ev.preventDefault(); opts[i].click(); }
  else if(ev.key==="Escape"){ t.nextElementSibling.hidden=true; } });
window.addEventListener("hashchange",()=>{ rota(); DB.carregado=false; iniciar(); });
iniciar();
document.addEventListener("toggle",ev=>{ const d=ev.target; if(d.dataset&&d.dataset.an!==undefined){ if(d.open) DB.openAn=d.dataset.an; else if(DB.openAn===d.dataset.an) DB.openAn=null; } },true);
