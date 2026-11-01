let somSerena=null;
async function tocaSomSerena(){
  if(DB.mute) return;
  try{ actx=actx||new (window.AudioContext||window.webkitAudioContext)(); if(actx.state==="suspended") await actx.resume();
    if(!somSerena){ const buf=new Uint8Array(await (await fetch("/som.mp3")).arrayBuffer());
      somSerena=await new Promise((ok,erro)=>actx.decodeAudioData(buf.buffer,ok,erro)); }
    const s=actx.createBufferSource(); s.buffer=somSerena; s.connect(actx.destination); s.start(); }catch(e){}
}
