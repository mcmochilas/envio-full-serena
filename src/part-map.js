/* ===== Mapa do estoque (mesmo desenho do app de Picking) ===== */
const colIdx = c => c.length===1 ? c.charCodeAt(0)-65 : (c.charCodeAt(0)-64)*26 + (c.charCodeAt(1)-65);
const LOC_RE = /^R(\d{1,2}|[A-Z])-L([A-Z])-(GAV|COL|BIN)-(\d{1,2})\.([A-Z]{1,2})$/;
const ruaKey = v => { const s=String(v??"").trim().toUpperCase().replace(/^R/,""); return /^\d{1,2}$/.test(s) && +s>=1 ? +s : /^[A-Z]$/.test(s) ? s : null; };
function parseCode(s){ const m=String(s||"").toUpperCase().match(LOC_RE); return m ? {r:ruaKey(m[1]), l:m[2], t:m[3], n:+m[4], c:m[5], ci:colIdx(m[5])} : null; }
const LOC_T={GAV:"gaveta",COL:"colmeia",BIN:"bin"};
function locTxt(code){ const l=parseCode(code); return l?`Rua ${l.r} · lado ${l.l} · ${LOC_T[l.t]} nível ${l.n} · coluna ${l.c}`:""; }
/* estruturas e endereços: em produção vêm das tabelas blocks e products do app de Picking (Supabase) */
let BLOCKS = {};
const ANIM=new Set();
function runMaps(){ document.querySelectorAll(".map-card[data-k]").forEach(el=>animateMap(el)); }
function animateMap(card){ const path=card.querySelector(".m-route"), op=card.querySelector(".m-op"); if(!path) return;
  const len=path.getTotalLength(); const finish=()=>{ path.style.strokeDasharray=""; path.style.strokeDashoffset=0; const p=path.getPointAtLength(len); op.setAttribute("cx",p.x); op.setAttribute("cy",p.y); card.classList.add("arrived"); };
  if(matchMedia("(prefers-reduced-motion: reduce)").matches || ANIM.has(card.dataset.k)) return finish();
  ANIM.add(card.dataset.k); path.style.strokeDasharray=len; path.style.strokeDashoffset=len; const dur=Math.min(2200,Math.max(900,len*4)), t0=performance.now();
  const ease=x=>x<.5?2*x*x:1-Math.pow(-2*x+2,2)/2;
  (function step(now){ const k=Math.min(1,(now-t0)/dur), e=ease(k); path.style.strokeDashoffset=len*(1-e); const p=path.getPointAtLength(e*len); op.setAttribute("cx",p.x); op.setAttribute("cy",p.y); k<1?requestAnimationFrame(step):finish(); })(t0);
}
const MAP = (()=>{
  const W=320, H=484, rackW=22, aisle=40, x0=14;
  const vx = k => x0 + (k-1)*(rackW+aisle);            // estante em pé k (1..4)
  const aisleX = r => vx(r) + rackW + aisle/2;          // centro do corredor da rua r
  const vTop=180, vBot=394, front=416;
  const hW = vx(4) + rackW - x0;
  const H2 = {x:x0, y:44, w:hW, h:20}, H1 = {x:x0, y:110, w:hW, h:20};
  const ruaB = (H2.y+H2.h+H1.y)/2, ruaA = (H1.y+H1.h+vTop)/2;
  const small = {x:aisleX(4)+aisle/2-2, y:50, w:20, h:118};
  const mesa = {x:52, y:436, w:216, h:28};
  return {W,H,rackW,aisle,x0,vx,aisleX,vTop,vBot,front,H1,H2,ruaA,ruaB,small,mesa,start:{x:160,y:front}};
})();
function mapTarget(l){
  const M=MAP, cols=Math.max(1, l.ci+1, ...Object.values(BLOCKS).filter(b=>b.r===l.r && b.l===l.l).map(b=>colIdx(b.c2)+1));
  const f=(l.ci+0.5)/cols;
  if(typeof l.r==="number" && l.r>=1 && l.r<=4){
    const ax=M.aisleX(l.r);
    if(l.l==="B" && l.r===4){ const seg=M.small.h/cols, y=M.small.y+M.small.h-(l.ci+1)*seg; return {kind:"v", aisle:4, x:ax, y:y+seg/2, cell:{x:M.small.x, y:y+1, w:M.small.w, h:Math.max(3,seg-2)}}; }
    const L=M.vBot-M.vTop, seg=L/cols, y=M.vBot-(l.ci+1)*seg, rx = l.l==="A" ? M.vx(l.r) : M.vx(l.r+1);
    return {kind:"v", aisle:l.r, x:ax, y:y+seg/2, cell:{x:rx, y:y+1, w:M.rackW, h:Math.max(3,seg-2)}};
  }
  if(l.r==="A" || l.r==="B"){
    const seg=M.H1.w/cols, x=M.H1.x+l.ci*seg;
    const y = l.r==="A" ? M.ruaA : M.ruaB;
    const face = l.r==="A" ? (l.l==="B" ? M.H1 : {y:M.vTop-6, h:6}) : (l.l==="A" ? M.H1 : M.H2);
    return {kind:l.r, x:x+seg/2, y, cell:{x:x+1, y:face.y, w:Math.max(3,seg-2), h:face.h}};
  }
  return {kind:"x", x:M.start.x, y:M.start.y, cell:null};
}
function mapRoute(a, b){ // caminho pelos corredores (a = item anterior ou null = mesa)
  const M=MAP, N={S:M.start}, E=[];
  for(let k=1;k<=4;k++){ N["f"+k]={x:M.aisleX(k),y:M.front}; N["t"+k]={x:M.aisleX(k),y:M.ruaA}; E.push(["S","f"+k],["f"+k,"t"+k]); if(k<4) E.push(["f"+k,"f"+(k+1)],["t"+k,"t"+(k+1)]); }
  N.b4={x:M.aisleX(4),y:M.ruaB}; E.push(["t4","b4"]);
  if(a && ((a.kind==="v" && b.kind==="v" && a.aisle===b.aisle) || (a.kind===b.kind && (b.kind==="A"||b.kind==="B")))) return [a,b];
  const att = t => t.kind==="v" ? ["f"+t.aisle,"t"+t.aisle] : t.kind==="A" ? [1,2,3,4].map(k=>"t"+k) : t.kind==="B" ? ["b4"] : ["S"];
  N.src = a ? {x:a.x,y:a.y} : M.start; N.dst = {x:b.x,y:b.y};
  const adj={}, add=(u,v)=>{ (adj[u]||=[]).push(v); (adj[v]||=[]).push(u); };
  E.forEach(([u,v])=>add(u,v)); (a?att(a):["S"]).forEach(n=>add("src",n)); att(b).forEach(n=>add("dst",n));
  const d=(p,q)=>Math.abs(p.x-q.x)+Math.abs(p.y-q.y), dist={src:0}, prev={}, Q=new Set(Object.keys(N));
  while(Q.size){ let u=null; for(const q of Q) if(dist[q]!=null && (u===null || dist[q]<dist[u])) u=q; if(u===null || u==="dst") break; Q.delete(u);
    for(const v of adj[u]||[]){ const nd=dist[u]+d(N[u],N[v]); if(dist[v]==null || nd<dist[v]){ dist[v]=nd; prev[v]=u; } } }
  const path=[]; for(let u="dst"; u; u=prev[u]) path.unshift(N[u]);
  return path.filter((p,i)=>!i || p.x!==path[i-1].x || p.y!==path[i-1].y);
}
function mapSVG(item, prevItem){
  const M=MAP, l=item.loc, t=mapTarget(l), pv=prevItem?.loc ? mapTarget(prevItem.loc) : null;
  const pts=mapRoute(pv, t), d="M"+pts.map(p=>`${p.x} ${p.y}`).join(" L"), from=pts[0];
  const R=(r,cls)=>`<rect class="${cls}" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="2"/>`;
  let s=`<svg viewBox="0 0 ${M.W} ${M.H}" role="img" aria-label="Mapa do estoque: vá até a rua ${l.r}, lado ${l.l}, coluna ${l.c}, nível ${l.n}">`;
  s+=`<rect class="m-floor" x="0" y="0" width="${M.W}" height="${M.H}" rx="12"/>`;
  // corredor de destino destacado
  if(t.kind==="v") s+=`<rect class="m-lane" x="${M.aisleX(t.aisle)-M.aisle/2}" y="${t.aisle===4?M.H2.y:M.vTop}" width="${M.aisle}" height="${(t.aisle===4?M.vBot-M.H2.y:M.vBot-M.vTop)}"/>`;
  if(t.kind==="A"||t.kind==="B") s+=`<rect class="m-lane" x="${M.x0}" y="${(t.kind==="A"?M.H1.y+M.H1.h:M.H2.y+M.H2.h)}" width="${M.H1.w}" height="${t.kind==="A"?M.vTop-M.H1.y-M.H1.h:M.H1.y-M.H2.y-M.H2.h}"/>`;
  // paredes
  s+=`<path class="m-wall" d="M8 38 H${M.small.x+M.small.w+4} V${M.vTop+8} H${M.W-8} V${M.H-12} H8 Z"/>`;
  // estantes
  for(let k=1;k<=4;k++) s+=R({x:M.vx(k),y:M.vTop,w:M.rackW,h:M.vBot-M.vTop},"m-rack");
  s+=R(M.H1,"m-rack")+R(M.H2,"m-rack")+R(M.small,"m-rack");
  if(t.cell) s+=R(t.cell,"m-cell target");
  // nomes das ruas
  for(let k=1;k<=4;k++){ const x=M.aisleX(k)+4, y=M.vBot-6; s+=`<text class="m-rua" x="${x}" y="${y}" transform="rotate(-90 ${x} ${y})">RUA ${k}</text>`; }
  s+=`<text class="m-rua" x="${M.x0+6}" y="${M.ruaA+4}">RUA A</text><text class="m-rua" x="${M.x0+6}" y="${M.ruaB+4}">RUA B</text>`;
  s+=`<rect class="m-dock" x="${M.mesa.x}" y="${M.mesa.y}" width="${M.mesa.w}" height="${M.mesa.h}" rx="6"/><text class="m-dock-t" x="${M.mesa.x+M.mesa.w/2}" y="${M.mesa.y+18}" text-anchor="middle">MESA DE SEPARAÇÃO</text>`;
  if(pv) s+=`<circle class="m-prev" cx="${from.x}" cy="${from.y}" r="4"/>`;
  s+=`<path class="m-route" d="${d}"/><circle class="m-ring" cx="${t.x}" cy="${t.y}" r="9"/><circle class="m-pin" cx="${t.x}" cy="${t.y}" r="6.5"/><circle class="m-op" cx="${from.x}" cy="${from.y}" r="6"/>`;
  return s+`</svg>`;
}
