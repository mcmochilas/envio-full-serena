/* parsers compartilhados (navegador e node) */
function zplDecode(s){ return s.replace(/(?:_[0-9A-F]{2})+/g, m=>{ const b=m.split("_").filter(Boolean).map(h=>parseInt(h,16)); try{ return new TextDecoder().decode(new Uint8Array(b)); }catch(e){ return m; } }); }
function parseZPL(text){
  const re=/\^BCN,[^\^]*\^FD(\w+)\^FS[\s\S]*?\^FB300,2,2,L\^FH\^FD([\s\S]*?)\^FS[\s\S]*?\^FH\^FD((?:SKU|Universal Code): [^\n\r]*)/g;
  const map=new Map(); let m;
  while((m=re.exec(text))){ const inv=m[1]; const a=map.get(inv)||{inv,titulo:zplDecode(m[2]).trim().replace(/\s+/g," "),ref:zplDecode(m[3]).trim(),etiquetas:0}; a.etiquetas++; map.set(inv,a); }
  return [...map.values()];
}
function sugestaoVinc(a){
  const k=(a.titulo.match(/^(\d+)x\s/i)||[])[1]; const s=a.ref.match(/^SKU: (\d+)(?:-0*(\d+))?/);
  const mult=k?+k:(s&&s[2]?+s[2]:1);
  return {cod:s?s[1]:"",mult};
}
function parsePrevendaLines(lines){
  const pv=((lines.join("\n").match(/Pré-venda\s*-\s*(\d+)/)||[])[1])||"";
  const itens=[];
  lines.forEach((l,i)=>{ const m=l.match(/(?:^|\s)(\d{5})\s+(.*?)\s*UN\s+([\d.]+),\d{3}/); if(!m) return;
    let prev=""; for(let j=i-1;j>=Math.max(0,i-2);j--){ if(lines[j].trim()&&!/\d{13}/.test(lines[j])&&!/Itens da|Cód\.|Produto|Imagem/.test(lines[j])){ prev=lines[j].trim(); break; } }
    let ean=""; for(let j=i+1;j<=i+2&&j<lines.length;j++){ const e=lines[j].match(/(\d{13})/); if(e){ ean=e[1]; break; } }
    itens.push({cod:m[1],nome:(prev+" "+m[2].replace(/Sem imagem/,"")).replace(/\s+/g," ").trim(),qtd:parseInt(m[3].replace(/\./g,""),10),ean}); });
  return {pv,itens};
}
async function pdfLines(pdfjs,data){
  const doc=await pdfjs.getDocument({data}).promise; const out=[];
  for(let p=1;p<=doc.numPages;p++){ const tc=await (await doc.getPage(p)).getTextContent(); const rows=[];
    tc.items.forEach(it=>{ if(!it.str.trim()) return; const y=it.transform[5], x=it.transform[4]; let r=rows.find(r=>Math.abs(r.y-y)<3); if(!r){ r={y,items:[]}; rows.push(r); } r.items.push({x,s:it.str}); });
    rows.sort((a,b)=>b.y-a.y).forEach(r=>out.push(r.items.sort((a,b)=>a.x-b.x).map(i=>i.s).join("   "))); }
  return out;
}
if(typeof module!=="undefined") module.exports={parseZPL,sugestaoVinc,parsePrevendaLines,pdfLines};
