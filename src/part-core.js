/*LOGO*/
const API="https://dtrfujxhfcyefbipkcwz.supabase.co/functions/v1/full-api";
const APP_URL=location.origin+location.pathname;
const KEY="envio-full-prefs";
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const $=s=>document.querySelector(s);
const now=()=>new Date().toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"});
const prod=cod=>DB.erp[cod]?{cod,...DB.erp[cod]}:null;
const locOf=cod=>(DB.locs||{})[cod]||"";
const locOrd=cod=>{ const l=parseCode(locOf(cod)); return l?[String(typeof l.r==="number"?l.r:10+l.r.charCodeAt(0)).padStart(3,"0"),l.l,String(l.ci).padStart(3,"0"),l.n].join("|"):"zz"; };
const nomeCod=cod=>prod(cod)?prod(cod).nome:`Código ${cod}`;
const nomeU=u=>DB.users[u]?DB.users[u].nome:u;
const ROLE=()=>DB.meObj?.role||"";
const sepUsers=()=>Object.keys(DB.users).filter(u=>DB.users[u].ativo!==false);

/* preferências locais (sessão, aba, som); os dados ficam no servidor */
let PREF={}; try{ PREF=JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){}
const DB={envios:[],erp:{},vinc:{},locs:{},users:{},me:null,meObj:null,tab:PREF.tab||"envios",sel:null,cur:PREF.cur||null,asExp:false,ph:{},lbl:null,mobile:null,mobileU:null,imp:null,f:{per:"todos",q:""},pg:{},mute:!!PREF.mute,qrTok:{},rev:null,carregado:false};
function save(){ try{ localStorage.setItem(KEY,JSON.stringify({token:PREF.token||null,tab:DB.tab,mute:DB.mute,cur:DB.cur})); }catch(e){} }
function toast(m){ const t=$("#toast"); t.textContent=m; t.hidden=false; clearTimeout(toast.h); toast.h=setTimeout(()=>t.hidden=true,3200); }

/* ---------- servidor ---------- */
async function api(op,body={}){
  const h={"content-type":"application/json"};
  if(DB.qr) h["x-full-qr"]=DB.qr; else if(PREF.token) h["x-full-token"]=PREF.token;
  let r; try{ r=await fetch(API,{method:"POST",headers:h,body:JSON.stringify({op,...body})}); }catch(e){ throw new Error("Sem conexão com o servidor. Verifique a internet."); }
  const j=await r.json().catch(()=>({erro:"Resposta inválida do servidor."}));
  if(r.status===401 && op!=="login"){ if(!DB.qr){ PREF.token=null; DB.me=null; DB.meObj=null; save(); render(); } throw new Error(j.erro||"Sessão expirada."); }
  if(j.erro) throw new Error(j.erro);
  return j;
}
function aplicar(st){
  DB.rev=st.rev; DB.meObj=st.me; DB.me=st.me.login;
  DB.users=Object.fromEntries(st.users.map(u=>[u.login,u]));
  DB.erp=Object.fromEntries(st.erp.map(p=>[p.cod,{nome:p.nome,ean:p.ean}]));
  DB.vinc=Object.fromEntries(st.vinc.map(v=>[v.inv,{cod:v.cod||"",mult:v.mult||1}]));
  DB.locs=st.locs||{}; BLOCKS=st.blocks||{};
  const sep={}, logs={};
  st.sep.forEach(s=>{ (sep[s.envio]=sep[s.envio]||{})[s.cod]={status:s.status,resp:s.resp,n:s.n,lab:s.lab||{}}; });
  st.logs.forEach(l=>{ (logs[l.envio]=logs[l.envio]||[]).unshift({t:new Date(l.at).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"}),msg:l.msg}); });
  DB.envios=st.envios.map(e=>({id:e.id,criado:Date.parse(e.criado),status:e.status,pvs:e.pvs||[],anuncios:e.anuncios||[],pre:e.pre||{},manual:e.manual||{},motivo:e.motivo||"",conferido:true,sep:sep[e.id]||{},log:logs[e.id]||[]}));
  DB.carregado=true;
}
async function carregar(force){
  const st=await api("state",force?{}:{since:DB.rev});
  if(st.same) return false;
  aplicar(st); return true;
}
let ocupado=0;
async function acao(fn,okMsg){ ocupado++; try{ await fn(); if(okMsg) toast(okMsg); }catch(e){ toast(e.message); } finally{ ocupado--; } try{ await carregar(true); }catch(e){} render(); }
const env=id=>DB.envios.find(e=>e.id===id);
const V=inv=>DB.vinc[inv]||{cod:"",mult:1};

const preQ=(e,cod)=>Object.values(e.pre[cod]||{}).reduce((a,b)=>a+b,0)+(e.manual?.[cod]?.qtd||0);
const LUPA='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true" style="vertical-align:-2px"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>';
function manualTag(e){ const m=Object.entries(e.manual||{}); if(!m.length) return ""; const t=m.map(([c,x])=>`${c} ${nomeCod(c)}: +${x.qtd} (${nomeU(x.por)})`).join("\n"); return `<span class="tag tag-acc" title="${esc(t)}">${LUPA} ${m.length} item${m.length>1?"s":""} adicionado${m.length>1?"s":""} à pré-venda</span>`; }
function pendVinc(e){ return e.anuncios.filter(a=>!V(a.inv).cod); }
function conf(e){
  const en={};
  e.anuncios.forEach(a=>{ const v=V(a.inv); if(!v.cod) return; const x=en[v.cod]||(en[v.cod]={un:0,kits:[],pecas:0});
    if(v.mult===1) x.un+=a.etiquetas; else x.kits.push({n:a.etiquetas,mult:v.mult}); x.pecas+=a.etiquetas*v.mult; });
  const cods=[...new Set([...Object.keys(en),...Object.keys(e.pre)])].sort((a,b)=>nomeCod(a).localeCompare(nomeCod(b)));
  const rows=cods.map(cod=>{ const x=en[cod]||{un:0,kits:[],pecas:0}; const p=preQ(e,cod); return {cod,x,p,d:p-x.pecas}; });
  return {rows,div:rows.filter(r=>r.d!==0),pecas:rows.reduce((s,r)=>s+r.x.pecas,0)};
}
const tot=e=>e.anuncios.reduce((s,a)=>s+a.etiquetas,0);

/* itens de separação: um por produto do ERP */
function itens(e){
  const m={};
  e.anuncios.forEach(a=>{ const v=V(a.inv); if(!v.cod) return; const it=m[v.cod]||(m[v.cod]={cod:v.cod,pecas:0,anuncios:[]}); it.pecas+=a.etiquetas*v.mult; it.anuncios.push({...a,mult:v.mult}); });
  return Object.values(m).sort((a,b)=>nomeCod(a.cod).localeCompare(nomeCod(b.cod))).map(it=>{ const s=e.sep[it.cod]||{status:"livre",n:0,lab:{}}; it.anuncios.sort((x,y)=>x.mult-y.mult); return {...it,s,etq:it.anuncios.reduce((t,a)=>t+a.etiquetas,0),lab:it.anuncios.reduce((t,a)=>t+Math.min(s.lab?.[a.inv]||0,a.etiquetas),0)}; });
}
const sepOf=(e,cod)=>e.sep[cod]||(e.sep[cod]={status:"livre",n:0,lab:{}});
const compo=it=>it.anuncios.map(a=>a.mult===1?`${a.etiquetas} unid.`:`${a.etiquetas} kit${a.etiquetas>1?"s":""} de ${a.mult}`).join(" + ");
const etqDone=e=>itens(e).reduce((t,i)=>t+i.lab,0);
const tudoEtiquetado=e=>itens(e).every(i=>i.s.status==="etiquetado");
function statusTag(e){
  if(e.status==="rascunho") return pendVinc(e).length?`<span class="tag tag-warn">Rascunho · ${pendVinc(e).length} vínculo pendente</span>`:`<span class="tag tag-acc">Rascunho · pronto p/ liberar</span>`;
  if(e.status==="concluido") return `<span class="tag tag-ok">Concluído</span>`;
  const its=itens(e); const mov=its.some(i=>i.s.status!=="livre");
  return mov?`<span class="tag tag-acc">Em preparo · ${its.filter(i=>i.s.status==="etiquetado").length}/${its.length} itens</span>`:`<span class="tag tag-off">Na fila da expedição</span>`;
}
const ST={livre:["Livre","tag-off"],separando:["Separando","tag-acc"],coletado:["Pronto p/ etiquetar","tag-warn"],impresso:["Etiquetando","tag-warn"],etiquetado:["Etiquetado","tag-ok"]};
function stTag(it){ const [l,c]=ST[it.s.status]; return `<span class="tag ${c}">${l}${it.s.resp&&it.s.status==="separando"?` · ${esc(nomeU(it.s.resp))}`:""}</span>`; }
function logE(e,msg){ e.log.push({t:now(),msg}); if(e.log.length>200) e.log.shift(); }

let actx=null;
function beep(ok){ if(DB.mute) return; try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); let t=actx.currentTime;
  (ok?[[1320,.07]]:[[220,.12],[180,.16]]).forEach(([f,d])=>{ const o=actx.createOscillator(),g=actx.createGain(); o.frequency.value=f; o.type=ok?"sine":"square"; g.gain.value=.08; o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t+d); t+=d+.04; }); }catch(x){} }
