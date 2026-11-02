/* ===== Etiqueta no mesmo layout do arquivo do ML (ZPL a 8 pontos/mm, igual ao PDF do Labelary) ===== */
const ZW=640, ZH=199; /* 80 mm × 24,9 mm, duas etiquetas por linha */
const ZFONT="Arial, Helvetica, 'Liberation Sans', sans-serif";
function zText(ctx,txt,x,y,h,sx){ ctx.save(); ctx.translate(x,y); ctx.scale(sx,1); ctx.font=`bold ${h}px ${ZFONT}`; ctx.textBaseline="top"; ctx.fillText(txt,0,0); ctx.restore(); }
function zWrap(ctx,txt,h,sx,maxW,maxL){ ctx.save(); ctx.font=`bold ${h}px ${ZFONT}`; const w=s=>ctx.measureText(s).width*sx; const out=[]; let cur="";
  for(const word of txt.split(/\s+/)){ const t=cur?cur+" "+word:word; if(w(t)<=maxW||!cur) cur=t; else { out.push(cur); cur=word; } } if(cur) out.push(cur); ctx.restore();
  return out.slice(0,maxL); }
function zBarcode(ctx,code,x,y,h,mod){ const o={}; try{ JsBarcode(o,code,{format:"CODE128"}); }catch(e){ return; } const bits=(o.encodings||[]).map(e=>e.data).join("");
  for(let i=0;i<bits.length;i++) if(bits[i]==="1") ctx.fillRect(x+i*mod,y,mod,h); }
function zLabel(ctx,a,ox){
  ctx.fillStyle="#000";
  zBarcode(ctx,a.inv,ox+30,15,54,2);
  zText(ctx,a.inv,ox+105,75,21,0.98);
  zWrap(ctx,a.titulo,18,0.8,300,2).forEach((l,i)=>zText(ctx,l,ox+16,115+i*20,18,0.8));
  zText(ctx,a.ref||"",ox+16,172,18,0.8);
}
function zPage(pair){ const c=document.createElement("canvas"); c.width=ZW; c.height=ZH; const ctx=c.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,ZW,ZH);
  zLabel(ctx,pair[0],0); if(pair[1]) zLabel(ctx,pair[1],320); return c; }
function zPairs(it,inv){ const etq=it.anuncios.filter(a=>!inv||a.inv===inv).flatMap(a=>Array.from({length:a.etiquetas},()=>a)); const p=[]; for(let i=0;i<etq.length;i+=2) p.push([etq[i],etq[i+1]]); return p; }
function zPDF(it,inv){ const {jsPDF}=window.jspdf; const doc=new jsPDF({orientation:"landscape",unit:"pt",format:[226.64,70.58]});
  zPairs(it,inv).forEach((p,i)=>{ if(i) doc.addPage([226.64,70.58],"landscape"); doc.addImage(zPage(p).toDataURL("image/png"),"PNG",0,0,226.64,70.58,undefined,"FAST"); });
  return doc.output("blob"); }
async function imprimirPDF(e,cod,inv){
  const it=itens(e).find(i=>i.cod===cod); if(!window.jspdf){ toast("O gerador de PDF não carregou. Recarregue a página."); return false; }
  const blob=zPDF(it,inv), name=`Envio-${e.id}-${cod}${inv?"-"+inv:""}-etiquetas.pdf`, url=URL.createObjectURL(blob);
  const w=window.open(url,"_blank");
  if(!w){ const a=document.createElement("a"); a.href=url; a.download=name; document.body.appendChild(a); a.click(); a.remove(); toast("PDF baixado. Abra e imprima na térmica (80 × 25 mm)."); }
  else toast("PDF aberto em outra aba. Imprima na térmica (80 × 25 mm, 2 colunas).");
  setTimeout(()=>URL.revokeObjectURL(url),120000); return true;
}
