/* ---------- roteamento / login ---------- */
/* celular: #s-<token> (gerado no servidor, vale só para um envio e uma pessoa); sem login */
function rota(){ const m=location.hash.match(/^#s-([\w-]+)/); DB.qr=m?m[1]:null; if(!m){ DB.mobile=null; DB.mobileU=null; } }
rota();
function render(){ render0(); const m=document.querySelector(".mdl");
  if(DB.ajuda&&!DB.qr){ if(!m){ document.body.insertAdjacentHTML("beforeend",ajudaHtml()); document.body.style.overflow="hidden"; const x=document.querySelector(".mdl .hbtn"); if(x) x.focus(); } }
  else if(m){ m.remove(); document.body.style.overflow=""; const h=document.querySelector('[data-act="ajuda"]'); if(h) h.focus(); } }
document.addEventListener("keydown",ev=>{ if(ev.key==="Escape"&&DB.ajuda){ DB.ajuda=false; render(); } });
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
      await carregar(true); render(); }
    catch(x){ renderLogin(x.message); } };
}
async function iniciar(){
  if(DB.qr){ renderCarregando("Abrindo o envio…");
    try{ await carregar(true); DB.mobile=DB.meObj.qrEnvio; DB.mobileU=DB.meObj.login; }catch(x){ DB.carregado=true; DB.mobile="__x"; DB.mobileU=null; }
    render(); return; }
  if(PREF.token){ renderCarregando(); try{ await carregar(true); }catch(x){ PREF.token=null; save(); } }
  render();
}

/* ---------- atualização automática (outras pessoas no mesmo envio) ---------- */
function digitando(){ const a=document.activeElement; return a && (a.id==="fq"||a.dataset?.vq!==undefined||a.tagName==="TEXTAREA"||(a.closest&&a.closest("#uForm"))||a.type==="date"||a.type==="number"); }
setInterval(async()=>{
  if(document.hidden||ocupado||PEND>0||!DB.carregado||(!PREF.token&&!DB.qr)||DB.mobile==="__x") return;
  try{ const mudou=await carregar(false); if(mudou&&!digitando()){ const a=document.activeElement, id=a?.id, val=a?.value; render(); if(id){ const n=document.getElementById(id); if(n){ n.focus(); if(val&&n.value!==undefined&&!n.value) n.value=val; } } } }catch(e){}
},4000);

/* ---------- câmera do celular (BarcodeDetector) ---------- */
let CAM=null;
async function camLiga(e,u){
  const w=$("#camwrap"), v=$("#cam"); if(!w||!v) return;
  try{ const det=new BarcodeDetector({formats:["ean_13","ean_8","code_128","upc_a"]}); const st=await navigator.mediaDevices.getUserMedia({video:{facingMode:"environment"}});
    v.srcObject=st; await v.play(); w.hidden=false; CAM={st,ultimo:"",t:0};
    const loop=async()=>{ if(!CAM) return; try{ const r=await det.detect(v); if(r[0]){ const c=r[0].rawValue, agora=Date.now(); if(c!==CAM.ultimo||agora-CAM.t>1200){ CAM.ultimo=c; CAM.t=agora; phScan(e,u,c); atualizaPick(); } } }catch(x){} if(CAM) setTimeout(loop,250); };
    loop(); }
  catch(x){ toast("Não foi possível abrir a câmera."); }
}
function camDesliga(){ if(CAM){ CAM.st.getTracks().forEach(t=>t.stop()); CAM=null; } }
function atualizaPick(){ const cam=CAM; if(cam){ const v=$("#cam"); const w=$("#camwrap"); render(); const v2=$("#cam"), w2=$("#camwrap"); if(v2&&w2){ v2.srcObject=cam.st; v2.play(); w2.hidden=false; } else camDesliga(); } else render(); }

/* ---------- eventos ---------- */
document.addEventListener("click",ev=>{
  const pk0=ev.target.closest("[data-pick]");
  if(pk0){ const inv=pk0.dataset.inv; acao(()=>api("vinc",{inv,cod:pk0.dataset.pick,mult:V(inv).mult}),"Vínculo salvo."); return; }
  if(!ev.target.closest(".combo")) document.querySelectorAll(".clist").forEach(c=>c.hidden=true);
  const b=ev.target.closest("[data-act]"); if(!b) return; const act=b.dataset.act;
  if(act!=="delenv") DB.delPend=null;
  const e=DB.mobile?env(DB.mobile):DB.cur&&env(DB.cur); const u=b.dataset.u; const pk=DB.mobile?"_m":u;
  FOCUS=null;
  const sep=(acaoNome,cod,extra={},msg="")=>api("sep",{envio:e.id,cod,acao:acaoNome,msg,...extra});
  switch(act){
    case "logout": camDesliga(); api("logout").catch(()=>{}); PREF.token=null; DB.me=null; DB.meObj=null; DB.carregado=false; DB.cur=null; DB.lbl=null; break;
    case "tab": DB.tab=b.dataset.t; DB.uEdit=null; break;
    case "vpg": DB.vpg=+b.dataset.p; break;
    case "pg": DB.pg[b.dataset.k]=+b.dataset.p; if(b.dataset.k.startsWith("an-")) DB.openAn=b.dataset.k.slice(3); break;
    case "per": DB.f.per=b.dataset.p; DB.pg.envios=1; break;
    case "sel": DB.sel=b.dataset.id||null; break;
    case "novo": DB.sel="novo"; DB.imp=null; break;
    case "criar": { const I=DB.imp; if(!I||!I.anuncios.length){ toast("Suba os arquivos de etiquetas."); return; } if(!I.pvs.length){ toast("Suba também a pré-venda em PDF."); return; }
      b.disabled=true; b.textContent="Importando…";
      acao(async()=>{ await api("importar",{envio:{id:I.id,anuncios:I.anuncios,pre:I.pre,pvs:I.pvs},erp:I.erpNovos,vinc:I.vinc}); DB.f={per:"todos",q:""}; DB.sel=I.id; DB.imp=null; },`Envio #${I.id} importado.`); return; }
    case "delenv": { const id=b.dataset.id, e0=env(id);
      if(!(DB.delPend&&DB.delPend.id===id&&Date.now()-DB.delPend.t<6000)){ DB.delPend={id,t:Date.now()}; toast(e0&&e0.status!=="rascunho"?`Envio #${id} já está com a expedição. Clique no X de novo para excluir.`:`Clique no X de novo para excluir o envio #${id}.`); break; }
      DB.delPend=null; acao(async()=>{ await api("excluir",{id}); if(DB.sel===id) DB.sel=null; },`Envio #${id} excluído.`); return; }
    case "excluir": if(b.dataset.ok!=="1"){ b.dataset.ok="1"; b.textContent="Clique de novo para confirmar a exclusão"; return; } acao(async()=>{ await api("excluir",{id:b.dataset.id}); DB.sel=null; },"Rascunho excluído."); return;
    case "zpl": { const it=itens(e).find(i=>i.cod===b.dataset.cod); navigator.clipboard.writeText(zplFor(it)).then(()=>toast("ZPL copiado. Cole no utilitário da impressora térmica."),()=>toast("Não deu para copiar.")); return; }
    case "liberar": acao(()=>api("liberar",{id:b.dataset.id}),`Envio #${b.dataset.id} enviado para a fila da expedição.`); return;
    case "addpre": { const x=env(b.dataset.id); const r=conf(x).rows.find(r=>r.cod===b.dataset.cod); if(!r||r.d>=0) return;
      acao(()=>api("addpre",{id:x.id,cod:r.cod,qtd:-r.d}),`${-r.d} peças adicionadas à pré-venda. Lance também no ERP.`); return; }
    case "rmpre": acao(()=>api("rmpre",{id:b.dataset.id,cod:b.dataset.cod})); return;
    case "to-exp": DB.asExp=true; DB.cur=null; break;
    case "to-gestor": DB.asExp=false; DB.cur=null; break;
    case "home": DB.cur=null; DB.lbl=null; break;
    case "abrir": DB.cur=b.dataset.id; DB.lbl=null; DB.qrU=DB.me; break;
    case "concluir": acao(async()=>{ await api("concluir",{id:e.id}); DB.cur=null; },`Envio #${e.id} concluído.`); return;
    case "qrNovo": acao(async()=>{ await qrLink(e.id,qrU(),true); },"Link anterior cancelado. Novo QR gerado."); return;
    case "qrCopiar": qrLink(e.id,qrU()).then(l=>navigator.clipboard.writeText(l)).then(()=>toast("Link copiado."),x=>toast(x?.message||"Não deu para copiar.")); return;
    case "lbl": DB.lbl=b.dataset.cod; DB.lmsg=null; if(sepOf(e,DB.lbl).status==="impresso") FOCUS="lscan"; break;
    case "ajuda": DB.ajuda=true; break;
    case "ajudax": if(ev.target.closest("[data-stop]")&&!ev.target.closest('button[data-act="ajudax"]')) return; DB.ajuda=false; break;
    case "lblx": DB.lbl=null; DB.lmsg=null; break;
    case "imprimir": { const cod=b.dataset.cod, inv=b.dataset.inv||null; const it0=itens(e).find(i=>i.cod===cod); const a0=inv&&it0?it0.anuncios.find(x=>x.inv===inv):null;
      const oq=a0?`${a0.etiquetas} etiquetas ${a0.mult===1?"de unidade":"de kit"} de ${nomeCod(cod)}`:`as etiquetas de ${nomeCod(cod)}`;
      imprimirPDF(e,cod,inv).then(ok=>{ if(!ok) return; DB.jaImp=DB.jaImp||{}; (it0?it0.anuncios:[]).filter(x=>!inv||x.inv===inv).forEach(x=>DB.jaImp[e.id+"|"+x.inv]=true); FOCUS="lscan"; if(sepOf(e,cod).status==="coletado") acao(()=>sep("impresso",cod,{},`imprimiu ${oq}`)); else render(); }); return; }
    case "jaimp": { const cod=b.dataset.cod; FOCUS="lscan"; acao(()=>sep("impresso",cod,{},`imprimiu as etiquetas de ${nomeCod(cod)}`)); return; }
    case "uNovo": DB.uEdit={novo:true,role:"expedicao",ativo:true}; break;
    case "uEdit": DB.uEdit={...DB.users[u]}; break;
    case "uCancel": DB.uEdit=null; break;
    /* celular */
    case "p-pega": { const cod=b.dataset.cod; const s0=sepOf(e,cod); if(s0.status!=="livre"){ toast("Outra pessoa já pegou este item."); break; }
      otim(e,cod,"pega",{},`começou a separar ${nomeCod(cod)}`,s=>Object.assign(s,{status:"separando",resp:u,n:0}));
      DB.ph[pk]={scr:"pick",cod,msg:null}; FOCUS=`pscan-${u}`; window.scrollTo(0,0); break; }
    case "p-open": DB.ph[pk]={scr:"pick",cod:b.dataset.cod,msg:null}; FOCUS=`pscan-${u}`; break;
    case "p-back": camDesliga(); DB.ph[pk]={scr:"lista"}; break;
    case "p-mais": phScan(e,u,null); atualizaPick(); return;
    case "p-tudo": { const it=itens(e).find(i=>i.cod===b.dataset.cod); if(b.dataset.ok!=="1"){ b.dataset.ok="1"; b.textContent=`Confirmar: peguei as ${it.pecas} peças`; return; }
      otim(e,it.cod,"tudo",{total:it.pecas},"",s=>{ s.n=it.pecas; }); DB.ph[pk].msg={ok:true,t:"Todas as peças coletadas. Leve para a bancada."}; break; }
    case "p-cam": camLiga(e,u); return;
    case "p-camx": camDesliga(); $("#camwrap").hidden=true; return;
    case "p-done": { camDesliga(); const it=itens(e).find(i=>i.cod===b.dataset.cod);
      otim(e,it.cod,"done",{total:it.pecas},`coletou ${nomeCod(it.cod)} (${it.pecas} peças)`,s=>{ s.status="coletado"; });
      DB.ph[pk]={scr:"lista"}; toast(`${nomeCod(it.cod)} pronto para etiquetar no computador.`); window.scrollTo(0,0); break; }
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
  else if(t.id==="fEtq"||t.id==="fPdf"){ lerArquivos(t); }
  else if(t.id==="fde"||t.id==="fate"){ DB.f[t.id==="fde"?"de":"ate"]=t.value; DB.pg.envios=1; $("#elist").innerHTML=gEnviosList(); }
});
document.addEventListener("submit",ev=>{
  const f=ev.target; const e=DB.mobile?env(DB.mobile):DB.cur&&env(DB.cur);
  if(f.id==="lblForm"){ ev.preventDefault(); lblScan(e,$("#lscan").value); FOCUS=DB.lbl?"lscan":null; render(); }
  else if(f.classList.contains("pscan")){ ev.preventDefault(); const u=f.dataset.u; phScan(e,u,f.querySelector("input").value); FOCUS=`pscan-${u}`; render(); }
  else if(f.id==="uForm"){ ev.preventDefault(); const d={login:$("#uLogin").value.trim().toLowerCase(),nome:$("#uNome").value.trim(),role:$("#uRole").value,pin:$("#uPin").value.trim(),ativo:$("#uAtivo").checked};
    acao(async()=>{ await api("user",d); DB.uEdit=null; },"Usuário salvo."); }
});
document.addEventListener("focusin",ev=>{ if(ev.target.dataset?.vq!==undefined){ ev.target.select(); comboBusca(ev.target); } });
document.addEventListener("input",ev=>{ if(ev.target.dataset?.vq!==undefined) comboBusca(ev.target);
  if(ev.target.id==="fq"){ DB.f.q=ev.target.value; DB.pg.envios=1; $("#elist").innerHTML=gEnviosList(); } });
document.addEventListener("keydown",ev=>{ const t=ev.target; if(t.dataset?.vq===undefined) return; const opts=[...t.nextElementSibling.querySelectorAll(".copt")]; let i=opts.findIndex(o=>o.classList.contains("on"));
  if(ev.key==="ArrowDown"||ev.key==="ArrowUp"){ ev.preventDefault(); if(!opts.length) return; opts[i]?.classList.remove("on"); i=(i+(ev.key==="ArrowDown"?1:-1)+opts.length)%opts.length; opts[i].classList.add("on"); opts[i].scrollIntoView({block:"nearest"}); }
  else if(ev.key==="Enter"&&opts[i]){ ev.preventDefault(); opts[i].click(); }
  else if(ev.key==="Escape"){ t.nextElementSibling.hidden=true; } });
window.addEventListener("hashchange",()=>{ rota(); DB.carregado=false; iniciar(); });
iniciar();
